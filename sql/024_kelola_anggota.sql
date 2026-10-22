-- ============================================================================
-- 024_kelola_anggota.sql — KELOLA ANGGOTA AKUN (peran & status)
-- ============================================================================
-- Melengkapi UI kelola anggota: daftar akun yang menjadi anggota klub,
-- ubah peran, dan tangguhkan/aktifkan/keluarkan — semuanya dengan pemeriksaan
-- izin di database (bukan mengandalkan UI).
--
-- Aturan yang ditegakkan:
--   * Hanya owner/org_owner (permission club.manage_roles) yang boleh mengubah peran.
--   * Owner terakhir tidak bisa diturunkan atau ditangguhkan (klub wajib punya owner).
--   * Admin boleh menangguhkan/mengaktifkan anggota biasa, tetapi tidak menyentuh owner
--     (butuh club.manage_roles).
--   * Semua perubahan tercatat di audit_logs.
--
-- Idempotent & aditif.
-- ============================================================================

-- ---------------------------------------------------------------- daftar anggota akun
create or replace function public.anggota_akun(p_club uuid)
returns table (
  user_id uuid,
  email text,
  nama text,
  role text,
  status text,
  joined_at timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select cm.user_id,
         u.email::text,
         coalesce(nullif(p.display_name, ''), split_part(coalesce(u.email, 'anggota'), '@', 1)) as nama,
         cm.role,
         cm.status,
         cm.joined_at
  from public.club_members cm
  join auth.users u on u.id = cm.user_id
  left join public.profiles p on p.user_id = cm.user_id
  where cm.club_id = p_club
    and public.has_perm(p_club, 'club.manage_members')
  order by
    case cm.role when 'owner' then 1 when 'admin' then 2 when 'official' then 3 else 4 end,
    cm.created_at
$$;

-- ---------------------------------------------------------------- hitung owner aktif
create or replace function public.jumlah_owner_aktif(p_club uuid)
returns int
language sql stable security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.club_members cm
  where cm.club_id = p_club and cm.role = 'owner' and cm.status = 'active'
$$;

-- ---------------------------------------------------------------- ubah peran
create or replace function public.ubah_peran_anggota(p_club uuid, p_user uuid, p_role text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_peran text := lower(coalesce(p_role, ''));
  v_lama text;
  v_status text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'pesan', 'Harus masuk dulu.');
  end if;
  if not public.has_perm(p_club, 'club.manage_roles') then
    return jsonb_build_object('ok', false, 'pesan', 'Hanya pemilik klub yang boleh mengubah peran.');
  end if;
  if v_peran not in ('owner', 'admin', 'official', 'member') then
    return jsonb_build_object('ok', false, 'pesan', 'Peran tidak dikenal.');
  end if;

  select cm.role, cm.status into v_lama, v_status
  from public.club_members cm
  where cm.club_id = p_club and cm.user_id = p_user;

  if v_lama is null then
    return jsonb_build_object('ok', false, 'pesan', 'Akun itu bukan anggota klub ini.');
  end if;
  if v_lama = v_peran then
    return jsonb_build_object('ok', true, 'pesan', 'Peran tidak berubah.');
  end if;

  -- Owner terakhir tidak boleh diturunkan.
  if v_lama = 'owner' and v_status = 'active' and v_peran <> 'owner'
     and public.jumlah_owner_aktif(p_club) <= 1 then
    return jsonb_build_object('ok', false, 'pesan',
      'Ini satu-satunya pemilik aktif. Angkat pemilik lain dulu sebelum mengubah perannya.');
  end if;

  update public.club_members
     set role = v_peran
   where club_id = p_club and user_id = p_user;

  insert into public.audit_logs (actor_user_id, club_id, action, entity_type, entity_id, metadata)
  values (v_uid, p_club, 'peran_anggota_diubah', 'club_member', p_user::text,
          jsonb_build_object('dari', v_lama, 'ke', v_peran));

  return jsonb_build_object('ok', true, 'pesan', format('Peran diubah dari %s ke %s.', v_lama, v_peran));
end $$;

-- ---------------------------------------------------------------- ubah status
create or replace function public.ubah_status_anggota(p_club uuid, p_user uuid, p_status text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_status_baru text := lower(coalesce(p_status, ''));
  v_lama text;
  v_status_lama text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'pesan', 'Harus masuk dulu.');
  end if;
  if v_status_baru not in ('active', 'suspended', 'left') then
    return jsonb_build_object('ok', false, 'pesan', 'Status tidak dikenal.');
  end if;
  if not public.has_perm(p_club, 'club.manage_members') then
    return jsonb_build_object('ok', false, 'pesan', 'Kamu tidak berwenang mengelola anggota klub ini.');
  end if;

  select cm.role, cm.status into v_lama, v_status_lama
  from public.club_members cm
  where cm.club_id = p_club and cm.user_id = p_user;

  if v_lama is null then
    return jsonb_build_object('ok', false, 'pesan', 'Akun itu bukan anggota klub ini.');
  end if;

  -- Menyentuh owner butuh izin kelola peran, dan owner terakhir dilindungi.
  if v_lama = 'owner' then
    if not public.has_perm(p_club, 'club.manage_roles') then
      return jsonb_build_object('ok', false, 'pesan', 'Hanya pemilik klub yang boleh mengubah status pemilik.');
    end if;
    if v_status_baru <> 'active' and v_status_lama = 'active'
       and public.jumlah_owner_aktif(p_club) <= 1 then
      return jsonb_build_object('ok', false, 'pesan',
        'Ini satu-satunya pemilik aktif. Angkat pemilik lain dulu sebelum menonaktifkannya.');
    end if;
  end if;

  update public.club_members
     set status = v_status_baru,
         joined_at = case when v_status_baru = 'active' then coalesce(joined_at, now()) else joined_at end
   where club_id = p_club and user_id = p_user;

  insert into public.audit_logs (actor_user_id, club_id, action, entity_type, entity_id, metadata)
  values (v_uid, p_club, 'status_anggota_diubah', 'club_member', p_user::text,
          jsonb_build_object('dari', v_status_lama, 'ke', v_status_baru));

  return jsonb_build_object('ok', true, 'pesan',
    format('Status anggota diubah dari %s ke %s.', v_status_lama, v_status_baru));
end $$;

-- ---------------------------------------------------------------- hak eksekusi
revoke all on function public.anggota_akun(uuid) from public, anon;
revoke all on function public.jumlah_owner_aktif(uuid) from public, anon;
revoke all on function public.ubah_peran_anggota(uuid, uuid, text) from public, anon;
revoke all on function public.ubah_status_anggota(uuid, uuid, text) from public, anon;

grant execute on function public.anggota_akun(uuid) to authenticated;
grant execute on function public.jumlah_owner_aktif(uuid) to authenticated;
grant execute on function public.ubah_peran_anggota(uuid, uuid, text) to authenticated;
grant execute on function public.ubah_status_anggota(uuid, uuid, text) to authenticated;

-- Rollback:
--   drop function if exists public.ubah_status_anggota(uuid, uuid, text);
--   drop function if exists public.ubah_peran_anggota(uuid, uuid, text);
--   drop function if exists public.jumlah_owner_aktif(uuid);
--   drop function if exists public.anggota_akun(uuid);
