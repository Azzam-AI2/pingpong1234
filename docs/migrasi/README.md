# Migrasi Keamanan, Multi-Club & Multi-Cabang Olahraga

Urutan menjalankan file SQL di `sql/`, cara verifikasi, dan cara rollback.
Semua file **idempotent** (aman dijalankan berulang) dan **aditif** — tidak menghapus data klub,
turnamen, peserta, atau skor.

Project Supabase: `imowznszyieegltkfpxt` → SQL Editor: `https://supabase.com/dashboard/project/imowznszyieegltkfpxt/sql/new`

---

## 0. Struktur yang dituju

```
PLATFORM  (platform_admins — hanya pemilik)
   │
   └─ ORGANISASI  (organizations + organization_members: org_owner / org_admin)
        │            contoh: "ITD Sports Group"
        │
        ├─ KLUB "ITD PingPong Club"      → cabang: table_tennis
        ├─ KLUB "ITD Badminton Club"     → cabang: badminton
        └─ KLUB "ITD Padel Club"         → cabang: padel
             │
             ├─ club_members (owner / admin / official / member) + status
             ├─ members (daftar pemain — wajib punya akun, user_id)
             └─ tournaments / liga / bagan / skor
```

* **Level organisasi** = payung beberapa klub. `org_owner` setara owner di **semua klub dalam organisasinya**, tetapi **tidak** otomatis masuk ke klub milik organisasi lain.
* **Role klub tetap per klub** (`club_members`), jadi orang bisa `org_owner` di satu organisasi dan `member` di klub lain.
* **Satu klub = satu cabang olahraga utama** (lewat `club_sport_settings`). Menambah cabang baru = menambah klub baru di organisasi yang sama, bukan membangun ulang sistem login/keamanan.
* `tournaments.sport_id` opsional: kalau kosong, aturan mengikuti setelan klub. Ini pintu untuk satu klub menggelar lebih dari satu cabang olahraga kelak.

---

## 1. Prasyarat: cadangan

```bash
# dari folder proyek
node scripts/export-db.mjs
```

Menghasilkan `backup/<timestamp>/<tabel>.json` + `_ringkasan.json`. Folder `backup/` tidak di-commit (berisi data pribadi anggota).

**Cara memulihkan dari cadangan**: untuk setiap file, `POST /rest/v1/<tabel>` dengan isi array JSON-nya
(`curl -X POST "$URL/rest/v1/clubs" -H "apikey: $KEY" -H "Content-Type: application/json" -d @backup/<waktu>/clubs.json`).
Urutan impor: `clubs → members → tournaments → participants → knockout_matches → americano_rounds → americano_matches → league_rounds → league_matches`.

---

## 2. Urutan eksekusi

| # | File | Isi | Dampak ke aplikasi sekarang |
|---|---|---|---|
| 1 | `sql/000_bersihkan_data.sql` | **Opsional** — hapus semua data klub (mulai dari nol) | Daftar klub jadi kosong |
| 2 | `sql/010_core_platform.sql` | `profiles, sports, club_members, club_invitations, club_sport_settings, audit_logs, platform_admins`; kolom `clubs.slug/description/status/created_by/updated_at`, `members.user_id`, `created_by/updated_at` domain; lepas CHECK khusus tenis meja; trigger `updated_at` | **Tidak ada** |
| 3 | `sql/011_helpers.sql` | `role_has_perm, has_perm, is_club_member, my_clubs, is_platform_admin` | **Tidak ada** |
| 4 | `sql/014_organisasi.sql` | `organizations, organization_members`, `clubs.organization_id`, `tournaments.sport_id`, `audit_logs.organization_id`; helper naik level (`has_perm` cek klub **atau** organisasi; `my_clubs` + kolom `via`; `my_organizations`; `is_org_member`; `is_org_owner`) | **Tidak ada** |
| 5 | *(manual)* | Dashboard → **Authentication → Users → Add user** (email + password, centang *Auto Confirm User*) | — |
| 6 | `sql/012_bootstrap_owner.sql` | Buat organisasi + klub pertama (kalau kosong) + profil + `owner` klub + `org_owner` + `platform_admin` + setelan tenis meja. **Ganti email/nama di bagian deklarasi** | Klub muncul lagi (data baru) |
| 7 | `sql/013_buat_klub.sql` | **Opsional** — tambah klub cabang lain di organisasi yang sama (contoh: badminton). **Ganti nama/slug/cabang/email** | Klub baru muncul |

Setelah langkah 1–7, aplikasi versi sekarang masih berjalan seperti biasa (policy tabel domain belum diubah).
RLS ketat baru masuk di **fase 4** (`020_*`, `021_*`), bersamaan dengan rilis klien yang sudah punya login.

> `clubs.organization_id` sengaja **belum NOT NULL**: aplikasi versi sekarang belum mengirim kolom itu saat
> membuat klub. NOT NULL diberlakukan di fase 4 setelah pembuatan klub dipindah ke RPC `buat_klub`.

---

## 3. Matriks izin

### Level klub (`club_members.role`)

| Permission | owner | admin | official | member |
|---|:-:|:-:|:-:|:-:|
| `club.read` | ✓ | ✓ | ✓ | ✓ |
| `club.update` | ✓ | – | – | – |
| `club.manage_members` | ✓ | ✓ | – | – |
| `club.manage_roles` | ✓ | – | – | – |
| `competition.read` | ✓ | ✓ | ✓ | ✓ |
| `competition.create` / `update` / `delete` | ✓ | ✓ | – | – |
| `match.read` | ✓ | ✓ | ✓ | ✓ |
| `match.manage` | ✓ | ✓ | ✓ (semua match klub) | – |
| `score.read` | ✓ | ✓ | ✓ | ✓ |
| `score.submit` | ✓ | ✓ | ✓ | – |
| `score.finalize` | ✓ | ✓ | – | – |
| `audit.read` | ✓ | – | – | – |

### Level organisasi (`organization_members.role`)

| Role | Berlaku di | Setara dengan |
|---|---|---|
| `org_owner` | semua klub dalam organisasinya | `owner` (semua permission klub) |
| `org_admin` | semua klub dalam organisasinya | `admin` (tanpa `club.update`, `club.manage_roles`, `audit.read`) |

Tidak ada role organisasi yang otomatis mendapat akses ke organisasi/klub lain.

---

## 4. Verifikasi setelah tiap langkah (read-only)

```sql
-- tabel baru ada?
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

-- kolom baru?
select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and table_name in ('clubs','members','tournaments','audit_logs')
  and column_name in ('slug','status','created_by','updated_at','user_id','organization_id','sport_id')
order by table_name, column_name;

-- cabang olahraga terisi?
select slug, name, active from public.sports order by slug;

-- CHECK khusus tenis meja sudah lepas?
select conname from pg_constraint
where conrelid = 'public.tournaments'::regclass and contype = 'c' order by conname;

-- status RLS & policy
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' order by tablename, policyname;

-- siapa pemilik apa? (organisasi + klub + cabang)
select o.name as organisasi, c.name as klub, s.slug as cabang, u.email,
       cm.role as role_klub, om.role as role_organisasi
from public.clubs c
left join public.organizations o on o.id = c.organization_id
left join public.club_sport_settings cs on cs.club_id = c.id
left join public.sports s on s.id = cs.sport_id
left join public.club_members cm on cm.club_id = c.id
left join auth.users u on u.id = cm.user_id
left join public.organization_members om
       on om.organization_id = c.organization_id and om.user_id = cm.user_id
order by o.name, c.name;

-- fungsi helper ada?
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in
  ('role_has_perm','org_role_has_perm','has_perm','is_club_member','is_org_member','is_org_owner',
   'my_clubs','my_organizations','is_platform_admin','set_updated_at')
order by proname;
```

Yang **diharapkan** setelah langkah 2–4:
- 9 tabel baru muncul; semuanya **tidak bisa diakses lewat API** (grant dicabut + RLS tanpa policy).
- `tournaments` hanya menyisakan CHECK umum (`type`, `format`, `knockout_lengkap`, `liga_lengkap`).
- 9 tabel lama tetap memakai policy lama (anon penuh) → aplikasi tetap jalan.

---

## 5. Rollback

```sql
-- jalankan isi file: sql/99_rollback_phase2.sql
```

Menghapus tabel & kolom baru (termasuk organisasi). Data klub/anggota/turnamen/skor **tidak** tersentuh.
CHECK khusus tenis meja tidak dipulihkan otomatis (lihat catatan di akhir file rollback).

---

## 6. Menambah cabang olahraga baru

1. Pastikan slug cabang ada di `sports` (`table_tennis`, `badminton`, `padel` sudah terisi).
2. Jalankan `sql/013_buat_klub.sql` dengan `v_sport` = cabang yang diinginkan; aturan masuk ke
   `club_sport_settings.settings` (mis. bulu tangkis: `{"target_points":[21],"best_of":[3]}`).
3. **Fase 5 (belum dikerjakan)**: modul aturan di klien per cabang olahraga — sekarang logika kompetisi masih
   tenis meja (11 poin tanpa deuce; knockout/liga/americano). Bulu tangkis butuh 21 poin rally + best of 3
   (cap 30); padel butuh model set/game + tiebreak. Database tidak perlu diubah lagi untuk itu — yang berubah
   hanya modul aturan di `src/lib/sports/*` dan tampilan skor.

---

## 7. Keputusan final (dari persetujuan pemilik)

| Topik | Keputusan |
|---|---|
| Backend administratif | **Supabase Edge Functions** (service key hanya di secret fungsi) |
| CHECK khusus tenis meja | Dilonggarkan, pindah ke `club_sport_settings.settings` |
| Pemain | **Wajib punya akun** → `members.user_id` (NOT NULL nanti setelah semua pemain punya akun) |
| Data lama | **Dibersihkan dulu** (setelah cadangan) |
| Akses tanpa login | **Ditutup total** (anon tidak boleh baca/tulis data klub) |
| Cakupan `official` | **Semua pertandingan di klub** (tanpa tabel `match_officials`) |
| `score.finalize` | `owner` + `admin` (termasuk `org_owner` / `org_admin`) |
| Hapus/koreksi skor | Wajib alasan + tercatat di `audit_logs` |
| `platform_admin` | Hanya pemilik (satu orang), dikelola lewat SQL |
| Email undangan | Email bawaan Supabase |
| Level di atas klub | **Organisasi** (`organizations` + `org_owner` / `org_admin`) |

---

## 8. Langkah berikutnya (belum dikerjakan)

1. **Fase 3-2**: Edge Function `invite-member` (undangan via Admin API, expiry, status `pending/accepted/revoked/expired`).
2. **Fase 3-3**: klien — login/reset/terima undangan, sesi, pemilih **organisasi → klub**, navigasi sadar-permission.
3. **Fase 4**: policy RLS `SELECT` lalu `INSERT/UPDATE/DELETE`; RPC transaksional (`buat_klub`, `simpan_skor`, `hapus_klub`, …); `organization_id` NOT NULL; cabut grant `anon`.
4. **Fase 5**: registry aturan per cabang olahraga (`table_tennis` → `badminton` → `padel`).
5. **Fase 6**: uji keamanan otomatis + dokumentasi handover.
