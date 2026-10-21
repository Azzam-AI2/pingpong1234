-- ============================================================================
-- 021_rls_tulis.sql — POLICY TULIS BERBASIS PERMISSION (langkah B)
-- ============================================================================
-- Menambahkan aturan INSERT/UPDATE/DELETE untuk pengguna login, sesuai
-- permission di tabel club_members / organization_members.
--
-- Policy anon LAMA belum dihapus di sini. Pencabutan dilakukan di 023 setelah
-- semua tulis-terbatas ini teruji.
-- ============================================================================

-- ---------------------------------------------------------------- grant dasar
grant insert, update, delete on public.clubs, public.members, public.tournaments,
  public.participants, public.knockout_matches, public.americano_rounds,
  public.americano_matches, public.league_rounds, public.league_matches
to authenticated;

-- ---------------------------------------------------------------- profil
alter table public.profiles enable row level security;

drop policy if exists profil_baca_sendiri on public.profiles;
create policy profil_baca_sendiri on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or public.boleh_kelola_pendaftar());

drop policy if exists profil_ubah_sendiri on public.profiles;
create policy profil_ubah_sendiri on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'active');

-- ---------------------------------------------------------------- klub
-- Siapa pun yang login boleh membuat klub (identitas pembuat dicatat bila dikirim),
-- tetapi tidak otomatis mendapat akses ke klub lain.
drop policy if exists klub_buat on public.clubs;
create policy klub_buat on public.clubs
  for insert to authenticated
  with check (created_by is null or created_by = auth.uid());

drop policy if exists klub_ubah on public.clubs;
create policy klub_ubah on public.clubs
  for update to authenticated
  using (public.has_perm(id, 'club.update'))
  with check (public.has_perm(id, 'club.update'));

drop policy if exists klub_hapus on public.clubs;
create policy klub_hapus on public.clubs
  for delete to authenticated
  using (public.has_perm(id, 'club.update'));

-- ---------------------------------------------------------------- keanggotaan klub
-- Bootstrap: pembuat klub pertama boleh mendaftarkan dirinya sebagai owner.
drop policy if exists anggota_klub_buat on public.club_members;
create policy anggota_klub_buat on public.club_members
  for insert to authenticated
  with check (
    public.has_perm(club_id, 'club.manage_members')
    or (
      user_id = auth.uid()
      and role = 'owner'
      and not exists (
        select 1 from public.club_members cm
        where cm.club_id = club_members.club_id
          and cm.role = 'owner'
          and cm.status = 'active'
      )
    )
  );

drop policy if exists anggota_klub_ubah on public.club_members;
create policy anggota_klub_ubah on public.club_members
  for update to authenticated
  using (
    public.has_perm(club_id, 'club.manage_members')
    or (user_id = auth.uid() and status in ('active', 'left'))
  )
  with check (
    public.has_perm(club_id, 'club.manage_members')
    or (user_id = auth.uid() and status in ('active', 'left'))
  );

drop policy if exists anggota_klub_hapus on public.club_members;
create policy anggota_klub_hapus on public.club_members
  for delete to authenticated
  using (public.has_perm(club_id, 'club.manage_roles'));

-- ---------------------------------------------------------------- anggota (roster pemain)
drop policy if exists roster_buat on public.members;
create policy roster_buat on public.members
  for insert to authenticated
  with check (public.has_perm(club_id, 'club.manage_members'));

drop policy if exists roster_ubah on public.members;
create policy roster_ubah on public.members
  for update to authenticated
  using (public.has_perm(club_id, 'club.manage_members'))
  with check (public.has_perm(club_id, 'club.manage_members'));

drop policy if exists roster_hapus on public.members;
create policy roster_hapus on public.members
  for delete to authenticated
  using (public.has_perm(club_id, 'club.manage_members'));

-- ---------------------------------------------------------------- kompetisi
drop policy if exists turnamen_buat on public.tournaments;
create policy turnamen_buat on public.tournaments
  for insert to authenticated
  with check (public.has_perm(club_id, 'competition.create'));

drop policy if exists turnamen_ubah on public.tournaments;
create policy turnamen_ubah on public.tournaments
  for update to authenticated
  using (public.has_perm(club_id, 'competition.update'))
  with check (public.has_perm(club_id, 'competition.update'));

drop policy if exists turnamen_hapus on public.tournaments;
create policy turnamen_hapus on public.tournaments
  for delete to authenticated
  using (public.has_perm(club_id, 'competition.delete'));

-- ---------------------------------------------------------------- peserta
drop policy if exists peserta_tulis on public.participants;
create policy peserta_tulis on public.participants
  for all to authenticated
  using (public.has_perm(public.tournament_club(tournament_id), 'competition.update'))
  with check (public.has_perm(public.tournament_club(tournament_id), 'competition.update'));

-- ---------------------------------------------------------------- bagan & skor
-- Bagan knockout ditulis saat undian dan saat pemenang maju: butuh match.manage.
drop policy if exists bagan_tulis on public.knockout_matches;
create policy bagan_tulis on public.knockout_matches
  for all to authenticated
  using (public.has_perm(public.tournament_club(tournament_id), 'match.manage'))
  with check (public.has_perm(public.tournament_club(tournament_id), 'match.manage'));

drop policy if exists ronde_americano_tulis on public.americano_rounds;
create policy ronde_americano_tulis on public.americano_rounds
  for all to authenticated
  using (public.has_perm(public.tournament_club(tournament_id), 'match.manage'))
  with check (public.has_perm(public.tournament_club(tournament_id), 'match.manage'));

drop policy if exists skor_americano_tulis on public.americano_matches;
create policy skor_americano_tulis on public.americano_matches
  for all to authenticated
  using (public.has_perm(public.tournament_club(tournament_id), 'score.submit'))
  with check (public.has_perm(public.tournament_club(tournament_id), 'score.submit'));

drop policy if exists ronde_liga_tulis on public.league_rounds;
create policy ronde_liga_tulis on public.league_rounds
  for all to authenticated
  using (public.has_perm(public.tournament_club(tournament_id), 'match.manage'))
  with check (public.has_perm(public.tournament_club(tournament_id), 'match.manage'));

drop policy if exists skor_liga_tulis on public.league_matches;
create policy skor_liga_tulis on public.league_matches
  for all to authenticated
  using (public.has_perm(public.tournament_club(tournament_id), 'score.submit'))
  with check (public.has_perm(public.tournament_club(tournament_id), 'score.submit'));

-- ---------------------------------------------------------------- audit log
alter table public.audit_logs enable row level security;

drop policy if exists audit_baca on public.audit_logs;
create policy audit_baca on public.audit_logs
  for select to authenticated
  using (club_id is not null and public.has_perm(club_id, 'audit.read'));

drop policy if exists audit_tulis on public.audit_logs;
create policy audit_tulis on public.audit_logs
  for insert to authenticated
  with check (actor_user_id = auth.uid() or actor_user_id is null);

grant select, insert on public.audit_logs to authenticated;

-- ============================================================================
-- Rollback: sql/021_rollback.sql
-- ============================================================================
