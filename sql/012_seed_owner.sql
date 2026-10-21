-- ============================================================================
-- 012_seed_owner.sql  (ISI DULU EMAIL & NAMA KAMU di bagian bawah)
-- ============================================================================
-- Menetapkan akun pertama sebagai:
--   * profil aktif,
--   * owner klub pertama (klub yang sudah ada / kamu buat nanti),
--   * platform_admin (hanya kamu),
--   * plus konfigurasi olahraga default (tenis meja) untuk klub itu.
--
-- SYARAT: akunnya sudah dibuat di Supabase Dashboard -> Authentication -> Users -> Add user
--         (email + password, centang "Auto Confirm User").
-- Aman dijalankan berulang.
-- ============================================================================

do $$
declare
  v_email text := 'ISI_EMAIL_KAMU@contoh.com';   -- <<< GANTI
  v_nama  text := 'Nama Kamu';                    -- <<< GANTI (boleh dibiarkan)
  v_user  uuid;
  v_club  uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email) limit 1;
  if v_user is null then
    raise exception 'Akun auth dengan email % belum ada. Buat dulu di Authentication -> Users -> Add user (Auto Confirm).', v_email;
  end if;

  insert into public.profiles (user_id, display_name)
  values (v_user, v_nama)
  on conflict (user_id) do update set display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name);

  select id into v_club from public.clubs order by created_at limit 1;
  if v_club is null then
    raise exception 'Belum ada klub di tabel clubs. Buat klub dulu (lewat aplikasi atau jalankan 013_buat_klub.sql).';
  end if;

  insert into public.club_members (club_id, user_id, role, status, joined_at)
  values (v_club, v_user, 'owner', 'active', now())
  on conflict (club_id, user_id) do update set role = 'owner', status = 'active';

  insert into public.platform_admins (user_id) values (v_user) on conflict do nothing;

  insert into public.club_sport_settings (club_id, sport_id, settings)
  select v_club, s.id,
         '{"target_points":[11,15,21,24],"best_of":[3,5],"target_points_default":11,"best_of_default":3}'::jsonb
  from public.sports s where s.slug = 'table_tennis'
  on conflict (club_id) do nothing;

  raise notice 'OK: % (%) menjadi owner klub % dan platform admin.', v_email, v_user, v_club;
end $$;
