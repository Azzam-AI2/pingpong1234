-- ============================================================================
-- 015_undangan_rpc.sql  — UNDANGAN: profil otomatis + RPC terima/tolak
-- ============================================================================
-- Isi:
--   1. Trigger: setiap akun baru di auth.users otomatis punya baris profiles.
--      (Tanpa profil, has_perm() menolak semua karena status profil tidak ada.)
--   2. Backfill profil untuk akun yang sudah ada.
--   3. RPC undangan_saya()   -> undangan pending untuk email pengguna.
--   4. RPC terima_undangan() -> membuat club_members aktif + audit log.
--   5. RPC tolak_undangan()  -> menandai undangan ditolak (revoked).
--
-- Semua fungsi SECURITY DEFINER dengan search_path tetap, dan hanya boleh
-- dipanggil pengguna login (grant ke authenticated, cabut dari anon).
-- Idempotent: aman dijalankan berulang.
-- ============================================================================

-- ---------------------------------------------------------------- 1. profil otomatis
create or replace function public.buat_profil_otomatis()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, 'anggota'), '@', 1)
    )
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists auth_users_buat_profil on auth.users;
create trigger auth_users_buat_profil
  after insert on auth.users
  for each row execute function public.buat_profil_otomatis();

-- ---------------------------------------------------------------- 2. backfill profil
insert into public.profiles (user_id, display_name)
select u.id,
       coalesce(
         nullif(u.raw_user_meta_data ->> 'display_name', ''),
         nullif(u.raw_user_meta_data ->> 'full_name', ''),
         split_part(coalesce(u.email, 'anggota'), '@', 1)
       )
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

-- ---------------------------------------------------------------- 3. daftar undangan saya
create or replace function public.undangan_saya()
returns table (
  id uuid,
  club_id uuid,
  club_name text,
  role text,
  expires_at timestamptz,
  status text,
  invited_by_nama text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select i.id, i.club_id, c.name, i.role, i.expires_at, i.status, pr.display_name
  from public.club_invitations i
  join public.clubs c on c.id = i.club_id
  left join public.profiles pr on pr.user_id = i.invited_by
  where lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc
$$;

-- ---------------------------------------------------------------- 4. terima undangan
create or replace function public.terima_undangan(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_und     public.club_invitations;
  v_status  text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'pesan', 'Harus masuk dulu untuk menerima undangan.');
  end if;

  select * into v_und from public.club_invitations where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'pesan', 'Undangan tidak ditemukan.');
  end if;
  if lower(v_und.email) <> v_email then
    return jsonb_build_object('ok', false, 'pesan', 'Undangan ini bukan untuk akunmu.');
  end if;
  if v_und.status <> 'pending' then
    return jsonb_build_object('ok', false, 'pesan', 'Undangan sudah tidak berlaku.');
  end if;
  if v_und.expires_at <= now() then
    update public.club_invitations set status = 'expired' where id = v_und.id;
    return jsonb_build_object('ok', false, 'pesan', 'Undangan sudah kedaluwarsa. Minta undangan baru.');
  end if;

  -- pastikan profil ada (akun lama sebelum trigger dipasang)
  insert into public.profiles (user_id, display_name)
  select u.id,
         coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(u.email, 'anggota'), '@', 1))
  from auth.users u where u.id = v_uid
  on conflict (user_id) do nothing;

  select cm.status into v_status
  from public.club_members cm
  where cm.club_id = v_und.club_id and cm.user_id = v_uid;

  if v_status = 'active' then
    update public.club_invitations set status = 'accepted', accepted_at = now() where id = v_und.id;
    return jsonb_build_object('ok', true, 'club_id', v_und.club_id,
                              'pesan', 'Kamu sudah menjadi anggota klub ini.');
  end if;

  insert into public.club_members (club_id, user_id, role, status, joined_at)
  values (v_und.club_id, v_uid, v_und.role, 'active', now())
  on conflict (club_id, user_id) do update
    set status = 'active',
        joined_at = coalesce(public.club_members.joined_at, now()),
        role = case
                 when public.club_members.status = 'active' then public.club_members.role
                 else excluded.role
               end;

  update public.club_invitations set status = 'accepted', accepted_at = now() where id = v_und.id;

  insert into public.audit_logs (actor_user_id, club_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_und.club_id, 'undangan_diterima', 'club_invitation', v_und.id::text,
          jsonb_build_object('role', v_und.role, 'email', v_und.email));

  return jsonb_build_object('ok', true, 'club_id', v_und.club_id, 'role', v_und.role,
                            'pesan', 'Undangan diterima. Klub sudah bisa dibuka.');
end $$;

-- ---------------------------------------------------------------- 5. tolak undangan
create or replace function public.tolak_undangan(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_und   public.club_invitations;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'pesan', 'Harus masuk dulu.');
  end if;

  select * into v_und from public.club_invitations where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'pesan', 'Undangan tidak ditemukan.');
  end if;
  if lower(v_und.email) <> v_email then
    return jsonb_build_object('ok', false, 'pesan', 'Undangan ini bukan untuk akunmu.');
  end if;
  if v_und.status <> 'pending' then
    return jsonb_build_object('ok', false, 'pesan', 'Undangan sudah tidak berlaku.');
  end if;

  update public.club_invitations set status = 'revoked' where id = v_und.id;

  insert into public.audit_logs (actor_user_id, club_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_und.club_id, 'undangan_ditolak', 'club_invitation', v_und.id::text,
          jsonb_build_object('email', v_und.email));

  return jsonb_build_object('ok', true, 'pesan', 'Undangan ditolak.');
end $$;

-- ---------------------------------------------------------------- hak eksekusi
revoke all on function public.undangan_saya() from public, anon;
revoke all on function public.terima_undangan(uuid) from public, anon;
revoke all on function public.tolak_undangan(uuid) from public, anon;

grant execute on function public.undangan_saya() to authenticated;
grant execute on function public.terima_undangan(uuid) to authenticated;
grant execute on function public.tolak_undangan(uuid) to authenticated;
