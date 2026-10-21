-- ============================================================================
-- 013_buat_klub.sql  (OPSIONAL — kalau ingin membuat klub pertama dari SQL)
-- ============================================================================
-- Membuat klub baru + konfigurasi olahraganja + menjadikan pemanggil/email tertentu owner.
-- Ganti nilai di bagian deklarasi sebelum menjalankan. Aman dijalankan berulang
-- (dicari berdasarkan slug).
-- ============================================================================

do $$
declare
  v_nama  text := 'Pingpong Club Manager';      -- <<< GANTI
  v_slug  text := 'pingpong-club-manager';      -- <<< GANTI
  v_sport text := 'table_tennis';               -- table_tennis | badminton | padel
  v_owner_email text := 'ISI_EMAIL_KAMU@contoh.com';  -- <<< GANTI
  v_club uuid;
  v_user uuid;
  v_sport_id uuid;
begin
  insert into public.clubs (name, slug, status)
  values (v_nama, v_slug, 'active')
  on conflict (slug) do nothing;

  select id into v_club from public.clubs where slug = v_slug;
  select id into v_sport_id from public.sports where slug = v_sport;
  if v_sport_id is null then raise exception 'Cabang olahraga % tidak ada di tabel sports.', v_sport; end if;

  insert into public.club_sport_settings (club_id, sport_id, settings)
  values (v_club, v_sport_id,
          '{"target_points":[11,15,21,24],"best_of":[3,5],"target_points_default":11,"best_of_default":3}'::jsonb)
  on conflict (club_id) do update set sport_id = excluded.sport_id;

  select id into v_user from auth.users where lower(email) = lower(v_owner_email) limit 1;
  if v_user is null then raise exception 'Akun % belum ada. Buat dulu di Authentication -> Add user.', v_owner_email; end if;

  insert into public.club_members (club_id, user_id, role, status, joined_at)
  values (v_club, v_user, 'owner', 'active', now())
  on conflict (club_id, user_id) do update set role = 'owner', status = 'active';

  raise notice 'Klub % (%) siap, owner %', v_nama, v_club, v_owner_email;
end $$;
