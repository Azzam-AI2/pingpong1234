-- ============================================================================
-- 023_rollback.sql — buka kembali akses anon (HANYA untuk darurat)
-- ============================================================================
-- Jalankan kalau setelah 023 ada bagian aplikasi yang ternyata masih butuh
-- akses tanpa login. Ingat: ini mengembalikan risiko "siapa pun bisa
-- membaca/menulis lewat API".

grant select, insert, update, delete on public.clubs, public.members, public.tournaments,
  public.participants, public.knockout_matches, public.americano_rounds,
  public.americano_matches, public.league_rounds, public.league_matches
to anon;

grant select on public.sports to anon;

create policy clubs_akses_anon on public.clubs
  for all to anon using (true) with check (true);
create policy members_akses_anon on public.members
  for all to anon using (true) with check (true);
create policy tournaments_akses_anon on public.tournaments
  for all to anon using (true) with check (true);
create policy participants_akses_anon on public.participants
  for all to anon using (true) with check (true);
create policy knockout_matches_akses_anon on public.knockout_matches
  for all to anon using (true) with check (true);
create policy americano_rounds_akses_anon on public.americano_rounds
  for all to anon using (true) with check (true);
create policy americano_matches_akses_anon on public.americano_matches
  for all to anon using (true) with check (true);
create policy league_rounds_akses_anon on public.league_rounds
  for all to anon using (true) with check (true);
create policy league_matches_akses_anon on public.league_matches
  for all to anon using (true) with check (true);
