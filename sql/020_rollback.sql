-- ============================================================================
-- 020_rollback.sql — batalkan policy baca berbasis keanggotaan
-- ============================================================================
-- Policy lama (anon) tidak pernah dihapus di langkah A, jadi setelah rollback
-- ini aplikasi kembali ke kondisi sebelumnya.

drop policy if exists anggota_baca_klub on public.clubs;
drop policy if exists anggota_baca_anggota on public.members;
drop policy if exists anggota_baca_turnamen on public.tournaments;
drop policy if exists anggota_baca_peserta on public.participants;
drop policy if exists anggota_baca_bagan on public.knockout_matches;
drop policy if exists anggota_baca_ronde_americano on public.americano_rounds;
drop policy if exists anggota_baca_skor_americano on public.americano_matches;
drop policy if exists anggota_baca_ronde_liga on public.league_rounds;
drop policy if exists anggota_baca_skor_liga on public.league_matches;
drop policy if exists anggota_baca_cabang on public.sports;

drop function if exists public.is_tournament_member(uuid);
drop function if exists public.tournament_club(uuid);
