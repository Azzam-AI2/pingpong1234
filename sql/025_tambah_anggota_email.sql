-- ============================================================================
-- 025_tambah_anggota_email.sql — TAMBAH AKUN KE KLUB BERDASARKAN EMAIL
-- ============================================================================
-- Dipakai halaman "Akun" (khusus owner/admin):
--   * akun sudah ada  -> langsung dijadikan anggota klub dengan peran pilihan
--   * akun belum ada  -> kembalikan perlu_undang = true, klien mengirim undangan
--
-- Izin:
--   club.manage_members -> boleh menambah anggota
--   club.manage_roles   -> boleh memberi peran owner/admin; selain itu hanya
--                          official/member
-- Semua perubahan dicatat di audit_logs. Idempotent.
-- ============================================================================

create or replace function public.tambah_anggota_email(
  p_club uuid,
  p_email text,
  p_role text default 'member'
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_peran text := lower(coalesce(nullif(btrim(p_role), ''), 'member'));
  v_user uuid;
  v_boleh_peran boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'pesan', 'Harus masuk dulu.');
  end if;
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'pesan', 'Format email tidak valid.');
  end if;
  if not public.has_perm(p_club, 'club.manage_members') then
    return jsonb_build_object('ok', false, 'pesan', 'Kamu tidak berwenang menambah anggota di klub ini.');
  end if;

  v_boleh_peran := public.has_perm(p_club, 'club.manage_roles');
  if v_boleh_peran then
    if v_peran not in ('owner', 'admin', 'official', 'member') then
      return jsonb_build_object('ok', false, 'pesan', 'Peran tidak dikenal.');
    end if;
  else
    if v_peran not in ('official', 'member') then
      return jsonb_build_object('ok', false, 'pesan', 'Peran itu hanya boleh diberikan pemilik klub.');
    end if;
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = v_email limit 1;
  if v_user is null then
    return jsonb_build_object(
      'ok', false,
      'perlu_undang', true,
      'pesan', 'Email ini belum punya akun. Kirim undangan lewat bagian "Undang anggota baru".'
    );
  end if;

  insert into public.club_members (club_id, user_id, role, status, joined_at)
  values (p_club, v_user, v_peran, 'active', now())
  on conflict (club_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        joined_at = coalesce(public.club_members.joined_at, now());

  insert into public.audit_logs (actor_user_id, club_id, action, entity_type, entity_id, metadata)
  values (v_uid, p_club, 'anggota_ditambahkan', 'club_member', v_user::text,
          jsonb_build_object('email', v_email, 'role', v_peran));

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user,
    'pesan', format('%s sekarang menjadi %s di klub ini.', v_email, v_peran)
  );
end $$;

revoke all on function public.tambah_anggota_email(uuid, text, text) from public, anon;
grant execute on function public.tambah_anggota_email(uuid, text, text) to authenticated;

-- Rollback: drop function if exists public.tambah_anggota_email(uuid, text, text);
