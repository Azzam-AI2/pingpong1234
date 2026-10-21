-- ============================================================================
-- 020_rls_baca.sql — POLICY BACA BERBASIS KEANGGOTAAN (langkah A)
-- ============================================================================
-- Tujuan: pengguna yang login hanya bisa MEMBACA data klub tempat dia menjadi
-- anggota aktif (langsung atau lewat organisasi).
--
-- PENTING: policy lama untuk anon BELUM dihapus di langkah ini. Policy di
-- Postgres bersifat OR, jadi aplikasi versi sekarang tetap berjalan. Pencabutan
-- akses anon dilakukan di langkah B setelah semuanya teruji.
--
-- Idempotent: policy dibuat ulang dengan nama tetap (drop lalu create).
-- ============================================================================

-- ---------------------------------------------------------------- helper
-- Cek keanggotaan lewat turnamen (dipakai tabel anak: peserta, bagan, skor).
create or replace function public.is_tournament_member(p_turnamen uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = p_turnamen
      and public.is_club_member(t.club_id)
  )
$$;

-- Klub dari sebuah turnamen (dipakai untuk validasi tulis di langkah B).
create or replace function public.tournament_club(p_turnamen uuid)
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select t.club_id from public.tournaments t where t.id = p_turnamen
$$;

revoke all on function public.is_tournament_member(uuid) from public, anon;
revoke all on function public.tournament_club(uuid) from public, anon;
grant execute on function public.is_tournament_member(uuid) to authenticated;
grant execute on function public.tournament_club(uuid) to authenticated;

-- ---------------------------------------------------------------- hak baca dasar
-- Kolom/tabel tetap memakai grant yang sudah ada; pastikan authenticated punya SELECT.
grant select on public.clubs, public.members, public.tournaments, public.participants,
  public.knockout_matches, public.americano_rounds, public.americano_matches,
  public.league_rounds, public.league_matches, public.sports
to authenticated;

-- ---------------------------------------------------------------- policy baca klub
drop policy if exists anggota_baca_klub on public.clubs;
create policy anggota_baca_klub on public.clubs
  for select to authenticated
  using (public.is_club_member(id));

drop policy if exists anggota_baca_anggota on public.members;
create policy anggota_baca_anggota on public.members
  for select to authenticated
  using (public.is_club_member(club_id));

drop policy if exists anggota_baca_turnamen on public.tournaments;
create policy anggota_baca_turnamen on public.tournaments
  for select to authenticated
  using (public.is_club_member(club_id));

-- ---------------------------------------------------------------- policy baca tabel anak
drop policy if exists anggota_baca_peserta on public.participants;
create policy anggota_baca_peserta on public.participants
  for select to authenticated
  using (public.is_tournament_member(tournament_id));

drop policy if exists anggota_baca_bagan on public.knockout_matches;
create policy anggota_baca_bagan on public.knockout_matches
  for select to authenticated
  using (public.is_tournament_member(tournament_id));

drop policy if exists anggota_baca_ronde_americano on public.americano_rounds;
create policy anggota_baca_ronde_americano on public.americano_rounds
  for select to authenticated
  using (public.is_tournament_member(tournament_id));

drop policy if exists anggota_baca_skor_americano on public.americano_matches;
create policy anggota_baca_skor_americano on public.americano_matches
  for select to authenticated
  using (public.is_tournament_member(tournament_id));

drop policy if exists anggota_baca_ronde_liga on public.league_rounds;
create policy anggota_baca_ronde_liga on public.league_rounds
  for select to authenticated
  using (public.is_tournament_member(tournament_id));

drop policy if exists anggota_baca_skor_liga on public.league_matches;
create policy anggota_baca_skor_liga on public.league_matches
  for select to authenticated
  using (public.is_tournament_member(tournament_id));

-- ---------------------------------------------------------------- referensi cabang olahraga
drop policy if exists anggota_baca_cabang on public.sports;
create policy anggota_baca_cabang on public.sports
  for select to authenticated
  using (active = true);

-- ============================================================================
-- Verifikasi (jalankan terpisah):
--   select tablename, policyname, cmd, roles from pg_policies
--   where schemaname = 'public' order by tablename, policyname;
--
-- Rollback: jalankan sql/020_rollback.sql
-- ============================================================================
