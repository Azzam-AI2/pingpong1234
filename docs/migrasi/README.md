# Migrasi Keamanan & Multi-Club — Phase 2–3

Dokumen ini mencatat **urutan menjalankan** file SQL di `sql/`, cara memverifikasi, dan cara membatalkannya.
Semua file bersifat **idempotent** (aman dijalankan berulang) dan **aditif** — tidak menghapus data klub,
turnamen, peserta, atau skor.

Project Supabase: `imowznszyieegltkfpxt` → SQL Editor: `https://supabase.com/dashboard/project/imowznszyieegltkfpxt/sql/new`

---

## 0. Prasyarat: cadangan

```bash
# dari folder proyek
node scripts/export-db.mjs
```

Menghasilkan `backup/<timestamp>/<tabel>.json` + `_ringkasan.json`. Folder `backup/` tidak di-commit (berisi data pribadi anggota).
Cadangan terakhir sebelum migrasi: lihat `backup/` — 9 tabel, angka baris dicatat di `_ringkasan.json`.

**Cara memulihkan dari cadangan** (kalau perlu): untuk setiap file, `POST /rest/v1/<tabel>` dengan isi array JSON-nya
(mis. `curl -X POST "$URL/rest/v1/clubs" -H "apikey: $KEY" -H "Content-Type: application/json" -d @backup/<waktu>/clubs.json`).
Urutan impor: `clubs → members → tournaments → participants → knockout_matches → americano_rounds → americano_matches → league_rounds → league_matches`.

---

## 1. Urutan eksekusi

| # | File | Isi | Dampak ke aplikasi sekarang |
|---|---|---|---|
| 1 | `sql/000_bersihkan_data.sql` | **Opsional** — hapus semua data klub (mulai dari nol, sesuai keputusan) | Daftar klub jadi kosong |
| 2 | `sql/010_core_platform.sql` | Tabel `profiles, sports, club_members, club_invitations, club_sport_settings, audit_logs, platform_admins`; kolom `clubs.slug/description/status/created_by/updated_at`, `members.user_id`, `created_by/updated_at` domain; lepas CHECK khusus tenis meja; trigger `updated_at` | **Tidak ada** (aplikasi tetap jalan) |
| 3 | `sql/011_helpers.sql` | Fungsi `role_has_perm, has_perm, is_club_member, my_clubs, is_platform_admin` | **Tidak ada** |
| 4 | *(manual)* | Buat akunmu: Dashboard → **Authentication → Users → Add user** (email + password, centang *Auto Confirm User*) | — |
| 5 | `sql/012_seed_owner.sql` | Set dirimu sebagai `profiles`, `owner` klub pertama, `platform_admin`, plus setting tenis meja. **Ganti email/nama di bagian atas** | **Tidak ada** |
| 6 | `sql/013_buat_klub.sql` | **Opsional** — buat klub baru + owner dari SQL. **Ganti nama/slug/email** | Klub baru muncul |

Setelah langkah 1–6, aplikasi versi sekarang masih berjalan seperti biasa (policy tabel domain belum diubah).
RLS ketat baru masuk di **fase 4** (`020_*`, `021_*`), bersamaan dengan rilis klien yang sudah punya login.

---

## 2. Verifikasi setelah tiap langkah (read-only)

Tempel di SQL Editor:

```sql
-- tabel baru ada?
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

-- kolom baru di clubs & members?
select table_name, column_name from information_schema.columns
where table_schema = 'public' and table_name in ('clubs','members','tournaments')
  and column_name in ('slug','description','status','created_by','updated_at','user_id')
order by table_name, column_name;

-- sports terisi?
select slug, name, active from public.sports order by slug;

-- CHECK khusus tenis meja sudah lepas?
select conname from pg_constraint
where conrelid = 'public.tournaments'::regclass and contype = 'c' order by conname;

-- status RLS & policy
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' order by tablename, policyname;

-- siapa owner klub mana?
select c.name as klub, u.email, cm.role, cm.status
from public.club_members cm
join public.clubs c on c.id = cm.club_id
join auth.users u on u.id = cm.user_id
order by c.name, cm.role;

-- fungsi helper ada?
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in
  ('role_has_perm','has_perm','is_club_member','my_clubs','is_platform_admin','set_updated_at')
order by proname;
```

Yang **diharapkan** setelah langkah 2–3:
- 7 tabel baru muncul; `profiles/sports/club_members/...` **tidak** bisa diakses lewat API (grant dicabut + RLS tanpa policy).
- `tournaments` hanya menyisakan CHECK umum (`type`, `format`, `knockout_lengkap`, `liga_lengkap`).
- 9 tabel lama tetap punya policy lama (anon penuh) → aplikasi tetap jalan.

---

## 3. Rollback

```sql
-- batalkan seluruh migrasi phase 2 (tabel & kolom baru hilang, data klub tetap)
-- jalankan isi file:
sql/99_rollback_phase2.sql
```

Catatan: CHECK khusus tenis meja tidak dipulihkan otomatis oleh rollback; kalau perlu, jalankan ulang blok terkait di `supabase/schema.sql`.
Data klub, anggota, turnamen, peserta, dan skor **tidak tersentuh** oleh rollback.

---

## 4. Keputusan yang sudah final (dari persetujuan pemilik)

| Topik | Keputusan |
|---|---|
| Backend administratif | **Supabase Edge Functions** (service key hanya di secret fungsi) |
| CHECK khusus tenis meja | Dilonggarkan, pindah ke `club_sport_settings.settings` |
| Pemain | **Wajib punya akun** → `members.user_id` (dijadikan NOT NULL setelah semua pemain punya akun) |
| Data lama | **Dibersihkan dulu** (setelah cadangan) |
| Akses tanpa login | **Ditutup total** (anon tidak boleh baca/tulis data klub) |
| Cakupan `official` | **Semua pertandingan di klub** (tanpa tabel `match_officials`) |
| `score.finalize` | `owner` + `admin` |
| Hapus/koreksi skor | Wajib alasan + tercatat di `audit_logs` |
| `platform_admin` | Hanya pemilik (satu orang), dikelola lewat SQL |
| Email undangan | Email bawaan Supabase |

---

## 5. Langkah berikutnya (belum dikerjakan)

1. **Fase 3-2**: Edge Function `invite-member` (undangan via Admin API, expiry, status undangan).
2. **Fase 3-3**: klien — halaman login/reset/terima undangan, sesi, pemilih klub, navigasi sadar-permission.
3. **Fase 4**: policy RLS `SELECT` lalu `INSERT/UPDATE/DELETE`, RPC transaksional (`simpan_skor`, `hapus_klub`, …), cabut grant `anon`.
4. **Fase 5**: registry aturan per cabang olahraga (`table_tennis`, lalu `badminton`, `padel`).
5. **Fase 6**: uji keamanan otomatis + dokumentasi handover.
