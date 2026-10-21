-- ============================================================================
-- 016_tambah_anggota.sql  — JALUR MANUAL (tanpa Edge Function)
-- ============================================================================
-- Menjadikan akun yang SUDAH ADA sebagai anggota aktif sebuah klub, sekaligus
-- membuat baris roster (tabel members) supaya bisa ikut turnamen.
--
-- Pakai kalau undangan lewat email belum tersedia. Alur manualnya:
--   1. Dashboard -> Authentication -> Users -> Add user
--      (email + sandi, centang "Auto Confirm User")  -> akun jadi
--   2. Ganti nilai di blok deklarasi di bawah, lalu Run file ini.
--
-- Idempotent: aman dijalankan ulang untuk email yang sama.
-- ============================================================================

do $$
declare
  v_email      text := 'ISI_EMAIL_ANGGOTA@contoh.com';  -- <<< GANTI
  v_club_slug  text := 'itd-pingpong-club';             -- <<< slug klub tujuan
  v_role       text := 'member';                        -- owner|admin|official|member
  v_gender     text := 'L';                             -- L | P (untuk roster pemain)
  v_buat_roster boolean := true;                        -- false kalau tidak ikut turnamen
  v_user uuid;
  v_club uuid;
  v_nama text;
begin
  if v_role not in ('owner', 'admin', 'official', 'member') then
    raise exception 'Peran % tidak dikenal (owner/admin/official/member).', v_role;
  end if;

  select id into v_user from auth.users where lower(email) = lower(v_email) limit 1;
  if v_user is null then
    raise exception 'Akun % belum ada. Buat dulu: Authentication -> Users -> Add user (Auto Confirm).', v_email;
  end if;

  select id into v_club from public.clubs where slug = v_club_slug;
  if v_club is null then
    raise exception 'Klub dengan slug % tidak ditemukan.', v_club_slug;
  end if;

  insert into public.profiles (user_id, display_name)
  select v_user, split_part(v_email, '@', 1)
  on conflict (user_id) do nothing;

  insert into public.club_members (club_id, user_id, role, status, joined_at)
  values (v_club, v_user, v_role, 'active', now())
  on conflict (club_id, user_id) do update
    set role = excluded.role, status = 'active',
        joined_at = coalesce(public.club_members.joined_at, now());

  if v_buat_roster then
    select coalesce(display_name, split_part(v_email, '@', 1)) into v_nama
    from public.profiles where user_id = v_user;

    if not exists (
      select 1 from public.members where club_id = v_club and user_id = v_user
    ) then
      insert into public.members (club_id, name, gender, aktif, user_id)
      values (v_club, coalesce(v_nama, split_part(v_email, '@', 1)), v_gender, true, v_user);
      raise notice 'Roster pemain dibuat untuk %', v_email;
    end if;
  end if;

  insert into public.audit_logs (actor_user_id, club_id, action, entity_type, entity_id, metadata)
  values (null, v_club, 'anggota_ditambahkan_manual', 'club_member', v_user::text,
          jsonb_build_object('email', v_email, 'role', v_role, 'jalur', 'sql'));

  raise notice 'SELESAI: % = % di klub %', v_email, v_role, v_club_slug;
end $$;

-- Cek hasil:
-- select c.name as klub, u.email, cm.role, cm.status, m.name as nama_roster
-- from public.club_members cm
-- join public.clubs c on c.id = cm.club_id
-- join auth.users u on u.id = cm.user_id
-- left join public.members m on m.club_id = cm.club_id and m.user_id = cm.user_id
-- order by c.name, cm.role;
