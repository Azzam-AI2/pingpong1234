-- ============================================================================
-- 023_cabut_anon.sql — TUTUP AKSES TANPA LOGIN (langkah terakhir fase 4)
-- ============================================================================
-- Sebelum menjalankan ini, pastikan:
--   * 020 (policy baca keanggotaan) sudah jalan  -> terbukti: akun tanpa
--     keanggotaan melihat 0 baris.
--   * 021 (policy tulis per permission) sudah jalan -> aplikasi bisa menulis
--     sebagai pengguna login.
--   * 022 (trigger validasi skor) sudah jalan -> skor & pemenang divalidasi DB.
--
-- Setelah file ini: role anon TIDAK bisa membaca maupun menulis data klub.
-- Yang tetap bisa tanpa login: halaman aplikasi (HTML/JS) dan endpoint Auth
-- (signup/login), karena keduanya tidak memakai tabel aplikasi.
-- ============================================================================

-- ---------------------------------------------------------------- hapus policy anon lama
drop policy if exists clubs_akses_anon on public.clubs;
drop policy if exists members_akses_anon on public.members;
drop policy if exists tournaments_akses_anon on public.tournaments;
drop policy if exists participants_akses_anon on public.participants;
drop policy if exists knockout_matches_akses_anon on public.knockout_matches;
drop policy if exists americano_rounds_akses_anon on public.americano_rounds;
drop policy if exists americano_matches_akses_anon on public.americano_matches;
drop policy if exists league_rounds_akses_anon on public.league_rounds;
drop policy if exists league_matches_akses_anon on public.league_matches;

-- ---------------------------------------------------------------- cabut grant anon
revoke all on public.clubs, public.members, public.tournaments, public.participants,
  public.knockout_matches, public.americano_rounds, public.americano_matches,
  public.league_rounds, public.league_matches, public.sports
from anon;

-- ============================================================================
-- Verifikasi setelah dijalankan (jalankan terpisah):
--   select tablename, policyname, roles::text from pg_policies
--   where schemaname = 'public' and 'anon' = any(roles) order by tablename;
--   -- hasil yang diharapkan: 0 baris (tidak ada policy untuk anon)
--
-- Rollback: sql/023_rollback.sql
-- ============================================================================
