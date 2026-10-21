-- ============================================================================
-- 017_pendaftaran.sql — REGISTER MANDIRI + ANTREAN PENUGASAN KLUB
-- ============================================================================
-- Aturan main:
--   * Siapa pun boleh membuat akun (email + sandi) lewat Supabase Auth.
--   * Akun baru TIDAK otomatis jadi anggota klub mana pun -> tidak bisa melihat
--     data klub sampai owner/admin menugaskan.
--   * Pendaftar masuk ke antrean `pendaftar` (status 'menunggu').
--   * Hanya owner/admin (atau platform admin) yang boleh melihat antrean dan
--     menugaskan peran. Peran yang boleh diberikan mengikuti izin pemanggil.
--
-- Idempotent & aditif. Jalankan setelah 010-016.
-- ============================================================================

create table if not exists public.pendaftar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  nama text,
  status text not null default 'menunggu',
  catatan text,
  diproses_oleh uuid references auth.users(id) on delete set null,
  diproses_pada timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.pendaftar add constraint pendaftar_status_check
    check (status in ('menunggu', 'diterima', 'ditolak'));
exception when duplicate_object then null; end $$;

create index if not exists pendaftar_status_idx on public.pendaftar (status, created_at desc);

drop trigger if exists pendaftar_set_updated_at on public.pendaftar;
create trigger pendaftar_set_updated_at
  before update on public.pendaftar
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- hak melihat antrean
create or replace function public.boleh_kelola_pendaftar()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1 from public.club_members cm
      join public.profiles p on p.user_id = cm.user_id
      where cm.user_id = auth.uid() and cm.status = 'active' and p.status = 'active'
        and cm.role in ('owner', 'admin')
    )
    or exists (
      select 1 from public.organization_members om
      join public.profiles p on p.user_id = om.user_id
      where om.user_id = auth.uid() and om.status = 'active' and p.status = 'active'
        and om.role in ('org_owner', 'org_admin')
    )
    or public.is_platform_admin()
$$;

-- ---------------------------------------------------------------- RLS antrean
alter table public.pendaftar enable row level security;

drop policy if exists pendaftar_insert_diri on public.pendaftar;
create policy pendaftar_insert_diri on public.pendaftar
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists pendaftar_baca_pengelola on public.pendaftar;
create policy pendaftar_baca_pengelola on public.pendaftar
  for select to authenticated
  using (public.boleh_kelola_pendaftar());

-- Tidak ada policy UPDATE/DELETE: perubahan status hanya lewat RPC di bawah.

revoke all on public.pendaftar from anon;
grant select, insert on public.pendaftar to authenticated;

-- ---------------------------------------------------------------- antrean untuk pengelola
create or replace function public.daftar_menunggu()
returns table (id uuid, user_id uuid, email text, nama text, created_at timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select d.id, d.user_id, d.email, d.nama, d.created_at
  from public.pendaftar d
  where d.status = 'menunggu'
    and public.boleh_kelola_pendaftar()
  order by d.created_at
$$;

-- ---------------------------------------------------------------- tugaskan ke klub
create or replace function public.tugaskan_pendaftar(p_id uuid, p_club uuid, p_role text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_daftar public.pendaftar;
  v_peran  text := lower(coalesce(p_role, 'member'));
  v_boleh_peran boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'pesan', 'Harus masuk dulu.');
  end if;

  if not public.has_perm(p_club, 'club.manage_members') then
    return jsonb_build_object('ok', false, 'pesan', 'Kamu tidak berwenang menambah anggota di klub ini.');
  end if;

  v_boleh_peran := public.has_perm(p_club, 'club.manage_roles');
  if v_boleh_peran and v_peran not in ('owner', 'admin', 'official', 'member') then
    return jsonb_build_object('ok', false, 'pesan', 'Peran tidak dikenal.');
  end if;
  if not v_boleh_peran and v_peran not in ('official', 'member') then
    return jsonb_build_object('ok', false, 'pesan', 'Peran itu hanya boleh diberikan pemilik klub.');
  end if;

  select * into v_daftar from public.pendaftar where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'pesan', 'Pendaftar tidak ditemukan.');
  end if;
  if v_daftar.status <> 'menunggu' then
    return jsonb_build_object('ok', false, 'pesan', 'Pendaftar ini sudah diproses.');
  end if;

  insert into public.club_members (club_id, user_id, role, status, joined_at)
  values (p_club, v_daftar.user_id, v_peran, 'active', now())
  on conflict (club_id, user_id) do update
    set role = excluded.role, status = 'active',
        joined_at = coalesce(public.club_members.joined_at, now());

  update public.pendaftar
     set status = 'diterima', diproses_oleh = v_uid, diproses_pada = now()
   where id = v_daftar.id;

  insert into public.audit_logs (actor_user_id, club_id, action, entity_type, entity_id, metadata)
  values (v_uid, p_club, 'pendaftar_ditugaskan', 'pendaftar', v_daftar.id::text,
          jsonb_build_object('email', v_daftar.email, 'role', v_peran));

  return jsonb_build_object('ok', true, 'pesan',
    format('%s sekarang menjadi %s di klub ini.', v_daftar.email, v_peran));
end $$;

-- ---------------------------------------------------------------- tolak pendaftar
create or replace function public.tolak_pendaftar(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_daftar public.pendaftar;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'pesan', 'Harus masuk dulu.');
  end if;
  if not public.boleh_kelola_pendaftar() then
    return jsonb_build_object('ok', false, 'pesan', 'Kamu tidak berwenang memproses pendaftar.');
  end if;

  select * into v_daftar from public.pendaftar where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'pesan', 'Pendaftar tidak ditemukan.');
  end if;
  if v_daftar.status <> 'menunggu' then
    return jsonb_build_object('ok', false, 'pesan', 'Pendaftar ini sudah diproses.');
  end if;

  update public.pendaftar
     set status = 'ditolak', diproses_oleh = v_uid, diproses_pada = now()
   where id = v_daftar.id;

  insert into public.audit_logs (actor_user_id, club_id, action, entity_type, entity_id, metadata)
  values (v_uid, null, 'pendaftar_ditolak', 'pendaftar', v_daftar.id::text,
          jsonb_build_object('email', v_daftar.email));

  return jsonb_build_object('ok', true, 'pesan', 'Pendaftaran ditolak.');
end $$;

-- ---------------------------------------------------------------- hak eksekusi
revoke all on function public.boleh_kelola_pendaftar() from public, anon;
revoke all on function public.daftar_menunggu() from public, anon;
revoke all on function public.tugaskan_pendaftar(uuid, uuid, text) from public, anon;
revoke all on function public.tolak_pendaftar(uuid) from public, anon;

grant execute on function public.boleh_kelola_pendaftar() to authenticated;
grant execute on function public.daftar_menunggu() to authenticated;
grant execute on function public.tugaskan_pendaftar(uuid, uuid, text) to authenticated;
grant execute on function public.tolak_pendaftar(uuid) to authenticated;
