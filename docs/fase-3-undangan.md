# Fase 3-2 — Undangan anggota (Supabase Edge Function)

Alur undangan: **tidak ada pendaftaran publik**. Akun hanya lahir dari undangan
pemilik/admin klub, dan undangan itu sendiri hanya bisa dibuat oleh orang yang
punya izin `club.manage_members` di klub tersebut.

## Alur

```
owner/admin (login)                     Edge Function (service role)          penerima
      │                                          │                              │
      │  POST /functions/v1/invite-member        │                              │
      │  { aksi:"undang", club_id, email, role }  │                              │
      ├─────────────────────────────────────────▶│                              │
      │                                          │ 1. verifikasi JWT pemanggil  │
      │                                          │ 2. has_perm(club, manage_members)
      │                                          │ 3. batas peran yang boleh diberikan
      │                                          │ 4. simpan club_invitations (7 hari)
      │                                          │ 5. kirim email (Admin API)   │
      │◀── { ok, status:"email_terkirim" } ──────┤─────────────────────────────▶│
      │                                          │                              │  klik tautan
      │                                          │                              │  → #/atur-sandi
      │                                          │                              │  set sandi (updateUser)
      │                                          │                              │
      │                                          │◀── RPC undangan_saya() ──────┤
      │                                          │◀── RPC terima_undangan(id) ──┤ → club_members aktif + audit_logs
```

Kalau email sudah punya akun, tidak ada email yang dikirim (tidak ada identitas
duplikat). Undangan tersimpan dan muncul di halaman **#/undangan** milik orang itu
setelah dia masuk — cukup tekan **Terima**.

## Berkas

| Berkas | Isi |
|---|---|
| `sql/015_undangan_rpc.sql` | trigger `profiles` otomatis, backfill profil, `undangan_saya()`, `terima_undangan()`, `tolak_undangan()` |
| `supabase/functions/invite-member/index.ts` | Edge Function: `undang` / `batalkan` / `daftar` |
| `src/lib/auth.ts` | masuk, keluar, reset sandi, sesi, undangan, `my_clubs` |
| `src/pages/Masuk.tsx` | layar masuk & lupa sandi |
| `src/pages/AturSandi.tsx` | penetapan sandi dari tautan undangan |
| `src/pages/Undangan.tsx` | daftar undangan + terima/tolak |

## 1. Jalankan SQL

SQL Editor → tempel `sql/015_undangan_rpc.sql` → Run. Cek:

```sql
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in ('undangan_saya','terima_undangan','tolak_undangan')
order by proname;

select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
```

## 2. Deploy Edge Function

**Lewat dashboard** (tanpa CLI):

1. Supabase Dashboard → **Edge Functions** → **Deploy a new function**.
2. Nama: `invite-member`.
3. Ganti isi editor dengan seluruh isi `supabase/functions/invite-member/index.ts` → **Deploy**.
4. **Edge Functions → Secrets** → tambah `APP_URL` = `https://itdsportsclub.vercel.app`
   (tanpa garis miring di akhir). `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan
   `SUPABASE_SERVICE_ROLE_KEY` sudah tersedia otomatis di runtime Edge Function —
   jangan pernah menyalin service key ke kode atau ke frontend.

**Lewat CLI** (kalau login Supabase CLI sudah ada):

```bash
supabase functions deploy invite-member --project-ref imowznszyieegltkfpxt
supabase secrets set APP_URL=https://itdsportsclub.vercel.app --project-ref imowznszyieegltkfpxt
```

## 3. Konfigurasi Auth (wajib, kalau tidak tautan email salah tujuan)

Dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://itdsportsclub.vercel.app`
- **Redirect URLs** (tambahkan semua):
  - `https://itdsportsclub.vercel.app/**`
  - `http://localhost:4321/**` (untuk uji lokal)

Email undangan memakai pengirim bawaan Supabase (sesuai keputusan). Kuota gratis
±2–4 email/jam, jadi uji dengan email sendiri dulu.

## 4. Uji

Ambil JWT pengguna (dari aplikasi: DevTools → Application → Local Storage → kunci
`pcm.auth` → `access_token`), lalu:

```bash
FUNGSI="https://imowznszyieegltkfpxt.supabase.co/functions/v1/invite-member"
JWT="<access_token>"
CLUB="<uuid klub>"

# 1. positiv: owner mengundang member baru
curl -s -X POST "$FUNGSI" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"aksi":"undang","club_id":"'$CLUB'","email":"tes-anggota@contoh.com","role":"member"}'
# harapan: {"ok":true,"status":"email_terkirim"}

# 2. negativ: tanpa token
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$FUNGSI" -H "Content-Type: application/json" -d '{}'
# harapan: 401

# 3. negativ: admin memberi peran owner
curl -s -X POST "$FUNGSI" -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d '{"aksi":"undang","club_id":"'$CLUB'","email":"x@contoh.com","role":"owner"}'
# harapan (owner): 200; (admin): 403 "Peran "owner" tidak boleh kamu berikan"

# 4. batalkan undangan
curl -s -X POST "$FUNGSI" -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d '{"aksi":"batalkan","club_id":"'$CLUB'","email":"tes-anggota@contoh.com"}'
```

Matriks uji minimum:

| Skenario | Harapan |
|---|---|
| Tanpa token | 401 |
| Token member/official | 403 (tidak punya `club.manage_members`) |
| Owner mengundang email baru | 200 + `email_terkirim`, baris `pending` di `club_invitations` |
| Owner mengundang email yang sudah jadi anggota aktif | 409 |
| Admin memberi peran `owner` | 403 |
| Undangan diterima | `club_members.status='active'`, undangan `accepted`, ada baris `audit_logs` |
| Undangan diterima oleh email lain | ditolak ("bukan untuk akunmu") |
| Undangan lewat 7 hari | `expired` + pesan "minta undangan baru" |
| Tombol disembunyikan di UI lalu API dipanggil langsung | tetap 403 (izin dicek di server) |

## 5. Rollback

```sql
drop function if exists public.terima_undangan(uuid);
drop function if exists public.tolak_undangan(uuid);
drop function if exists public.undangan_saya();
drop trigger if exists auth_users_buat_profil on auth.users;
drop function if exists public.buat_profil_otomatis();
```

Edge Function: Dashboard → Edge Functions → `invite-member` → Delete.
Tabel `club_invitations` boleh dibiarkan (tidak dipakai lagi).

## 6. Yang belum ada (langkah berikutnya)

- Halaman **Kelola anggota** berbasis peran (undang/lihat status/batalkan/ubah role) —
  sekarang fungsi undang sudah lengkap, tinggal UI-nya.
- Penegakan RLS (fase 4): selama policy lama masih `anon` penuh, tombol yang
  disembunyikan **belum** menjadi jaminan keamanan data. Undangan sudah aman
  karena lewat Edge Function + RPC.
