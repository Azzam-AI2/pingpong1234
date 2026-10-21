-- ============================================================================
-- 012_bootstrap_owner.sql  (GANTI EMAIL/NAMA DI BAGIAN DEKATASI ATAS)
-- ============================================================================
-- Satu langkah untuk menyiapkan dirimu sebagai pemilik platform:
--   1. organisasi (payung beberapa klub),
--   2. klub pertama (kalau belum ada) + setting cabang olahraga,
--   3. profil + owner klub + org_owner + platform_admin.
--
-- SYARAT: akun sudah dibuat di Supabase Dashboard -> Authentication -> Users -> Add user
--         (isi email + password, centang "Auto Confirm User").
-- Jalankan SETELAH 010, 011, 014. Aman dijalankan berulang.
-- ============================================================================

do $$
declare
  v_email      text := 'ISI_EMAIL_KAMU@contoh.com';   -- <<< GANTI
  v_nama       text := 'Nama Kamu';                    -- <<< GANTI (boleh)
  v_org_nama   text := 'ITD Sports Group';             -- <<< GANTI (boleh)
  v_org_slug   text := 'itd-sports-group';             -- <<< GANTI (boleh, tanpa spasi)
  v_club_nama  text := 'ITD PingPong Club';            -- <<< dipakai kalau belum ada klub
  v_club_slug  text := 'itd-pingpong-club';            -- <<< dipakai kalau belum ada klub
  v_sport      text := 'table_tennis';                 -- table_tennis | badminton | padel
  v_user uuid; v_org uuid; v_club uuid; v_sport_id uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email) limit 1;
  if v_user is null then
    raise exception 'Akun auth % belum ada. Buat dulu: Authentication -> Users -> Add user (Auto Confirm).', v_email;
  end if;

  -- 1. organisasi
  insert into public.organizations (name, slug, created_by)
  values (v_org_nama, v_org_slug, v_user)
  on conflict (slug) do nothing;
  select id into v_org from public.organizations where slug = v_org_slug;
  update public.organizations set created_by = coalesce(created_by, v_user) where id = v_org;

  -- 2. profil
  insert into public.profiles (user_id, display_name)
  values (v_user, v_nama)
  on conflict (user_id) do update
    set display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name);

  -- 3. klub pertama
  select id into v_club from public.clubs where organization_id = v_org order by created_at limit 1;
  if v_club is null then
    select id into v_club from public.clubs where organization_id is null order by created_at limit 1;
  end if;
  if v_club is null then
    insert into public.clubs (name, slug, organization_id, created_by)
    values (v_club_nama, v_club_slug, v_org, v_user)
    returning id into v_club;
    raise notice 'Klub baru dibuat: % (%)', v_club_nama, v_club;
  else
    update public.clubs set organization_id = coalesce(organization_id, v_org) where id = v_club;
  end if;

  -- 4. keanggotaan: owner klub + org_owner + platform admin
  insert into public.club_members (club_id, user_id, role, status, joined_at)
  values (v_club, v_user, 'owner', 'active', now())
  on conflict (club_id, user_id) do update set role = 'owner', status = 'active';

  insert into public.organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org, v_user, 'org_owner', 'active', now())
  on conflict (organization_id, user_id) do update set role = 'org_owner', status = 'active';

  insert into public.platform_admins (user_id) values (v_user) on conflict do nothing;

  -- 5. setting cabang olahraga klub
  select id into v_sport_id from public.sports where slug = v_sport;
  if v_sport_id is null then
    raise exception 'Cabang olahraga % tidak ada di tabel sports (lihat 010).', v_sport;
  end if;
  insert into public.club_sport_settings (club_id, sport_id, settings)
  values (v_club, v_sport_id,
          '{"target_points":[11,15,21,24],"best_of":[3,5],"target_points_default":11,"best_of_default":3}'::jsonb)
  on conflict (club_id) do update set sport_id = excluded.sport_id;

  raise notice 'SELESAI: % = org_owner di % + owner klub % + platform admin.',
    v_email, v_org_nama, v_club;
end $$;
