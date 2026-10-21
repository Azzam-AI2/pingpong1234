-- ============================================================================
-- 021_rollback.sql — batalkan policy tulis berbasis permission
-- ============================================================================

drop policy if exists profil_baca_sendiri on public.profiles;
drop policy if exists profil_ubah_sendiri on public.profiles;
drop policy if exists klub_buat on public.clubs;
drop policy if exists klub_ubah on public.clubs;
drop policy if exists klub_hapus on public.clubs;
drop policy if exists anggota_klub_buat on public.club_members;
drop policy if exists anggota_klub_ubah on public.club_members;
drop policy if exists anggota_klub_hapus on public.club_members;
drop policy if exists roster_buat on public.members;
drop policy if exists roster_ubah on public.members;
drop policy if exists roster_hapus on public.members;
drop policy if exists turnamen_buat on public.tournaments;
drop policy if exists turnamen_ubah on public.tournaments;
drop policy if exists turnamen_hapus on public.tournaments;
drop policy if exists peserta_tulis on public.participants;
drop policy if exists bagan_tulis on public.knockout_matches;
drop policy if exists ronde_americano_tulis on public.americano_rounds;
drop policy if exists skor_americano_tulis on public.americano_matches;
drop policy if exists ronde_liga_tulis on public.league_rounds;
drop policy if exists skor_liga_tulis on public.league_matches;
drop policy if exists audit_baca on public.audit_logs;
drop policy if exists audit_tulis on public.audit_logs;

revoke insert, update, delete on public.clubs, public.members, public.tournaments,
  public.participants, public.knockout_matches, public.americano_rounds,
  public.americano_matches, public.league_rounds, public.league_matches
from authenticated;
