-- ============================================================================
-- 013_buat_klub.sql  (TAMBAH KLUB BARU — MISALNYA CABANG OLAHRAGA LAIN)
-- ============================================================================
-- Membuat klub di dalam organisasi, dengan cabang olahraga sendiri.
-- Contoh: klub bulu tangkis di organisasi yang sama dengan klub pingpong.
-- GANTI nilai di bagian deklarasi. Aman dijalankan berulang (dicari lewat slug).
-- ============================================================================

do $$
declare
  v_club_nama  text := 'ITD Badminton Club';    -- <<< GANTI
  v_club_slug  text := 'itd-badminton-club';    -- <<< GANTI
  v_sport      text := 'badminton';             -- table_tennis | badminton | padel
  v_org_slug   text := 'itd-sports-group';      -- <<< organisasi induk
  v_owner_email text := 'ISI_EMAIL_KAMU@contoh.com';  -- <<< GANTI
  v_settings   jsonb := '{"target_points":[21],"best_of":[3],"target_points_default":21,"best_of_default":3}';
  v_club uuid; v_org uuid; v_user uuid; v_sport_id uuid;
begin
  select id into v_org from public.organizations where slug = v_org_slug;
  if v_org is null then raise exception 'Organisasi % tidak ditemukan (jalankan 012 dulu).', v_org_slug; end if;

  select id into v_sport_id from public.sports where slug = v_sport;
  if v_sport_id is null then raise exception 'Cabang olahraga % tidak dikenal.', v_sport; end if;

  insert into public.clubs (name, slug, organization_id)
  values (v_club_nama, v_club_slug, v_org)
  on conflict (slug) do nothing;

  select id into v_club from public.clubs where slug = v_club_slug;
  update public.clubs set organization_id = coalesce(organization_id, v_org) where id = v_club;

  insert into public.club_sport_settings (club_id, sport_id, settings)
  values (v_club, v_sport_id, v_settings)
  on conflict (club_id) do update set sport_id = excluded.sport_id, settings = excluded.settings;

  select id into v_user from auth.users where lower(email) = lower(v_owner_email) limit 1;
  if v_user is null then raise exception 'Akun % belum ada.', v_owner_email; end if;

  insert into public.club_members (club_id, user_id, role, status, joined_at)
  values (v_club, v_user, 'owner', 'active', now())
  on conflict (club_id, user_id) do update set role = 'owner', status = 'active';

  raise notice 'Klub % (%) cabang % siap; owner %', v_club_nama, v_club, v_sport, v_owner_email;
end $$;
