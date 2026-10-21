-- ============================================================================
-- 011_helpers.sql
-- ============================================================================
-- Fungsi bantu authorization. Semua pemeriksaan memakai auth.uid() dari token sesi,
-- BUKAN parameter dari browser. SECURITY DEFINER + search_path tetap agar aman.
-- Aman dijalankan berulang. Belum mengubah policy tabel domain (itu fase 4).
-- ============================================================================

-- Peta role -> permission (satu sumber kebenaran)
create or replace function public.role_has_perm(p_role text, p_perm text)
returns boolean
language sql immutable
as $$
  select case p_role
    when 'owner' then p_perm in (
      'club.read','club.update','club.manage_members','club.manage_roles',
      'competition.read','competition.create','competition.update','competition.delete',
      'match.read','match.manage','score.read','score.submit','score.finalize','audit.read')
    when 'admin' then p_perm in (
      'club.read','club.manage_members',
      'competition.read','competition.create','competition.update','competition.delete',
      'match.read','match.manage','score.read','score.submit','score.finalize')
    when 'official' then p_perm in (
      'club.read','competition.read','match.read','match.manage','score.read','score.submit')
    when 'member' then p_perm in ('club.read','competition.read','match.read','score.read')
    else false
  end
$$;

-- Apakah pengguna aktif (bukan disabled) dan anggota aktif klub dengan permission tertentu
create or replace function public.has_perm(p_club uuid, p_perm text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.club_members cm
    join public.profiles p on p.user_id = cm.user_id
    where cm.club_id = p_club
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and p.status = 'active'
      and public.role_has_perm(cm.role, p_perm)
  )
$$;

-- Apakah anggota aktif klub (tanpa melihat role)
create or replace function public.is_club_member(p_club uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.club_members cm
    join public.profiles p on p.user_id = cm.user_id
    where cm.club_id = p_club and cm.user_id = auth.uid()
      and cm.status = 'active' and p.status = 'active'
  )
$$;

-- Daftar klub milik pengguna + role-nya (dipakai klien untuk pemilih klub)
create or replace function public.my_clubs()
returns table (club_id uuid, club_name text, role text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select c.id, c.name, cm.role
  from public.club_members cm
  join public.profiles p on p.user_id = cm.user_id
  join public.clubs c on c.id = cm.club_id
  where cm.user_id = auth.uid()
    and cm.status = 'active'
    and p.status = 'active'
    and c.status <> 'disabled'
  order by c.name
$$;

-- Apakah pemanggil platform admin (untuk operasi lintas platform, bukan akses klub)
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid())
$$;

-- Hak eksekusi: hanya pengguna login. anon tidak boleh memanggil.
revoke all on function public.role_has_perm(text, text) from public, anon;
revoke all on function public.has_perm(uuid, text) from public, anon;
revoke all on function public.is_club_member(uuid) from public, anon;
revoke all on function public.my_clubs() from public, anon;
revoke all on function public.is_platform_admin() from public, anon;

grant execute on function public.role_has_perm(text, text) to authenticated;
grant execute on function public.has_perm(uuid, text) to authenticated;
grant execute on function public.is_club_member(uuid) to authenticated;
grant execute on function public.my_clubs() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
