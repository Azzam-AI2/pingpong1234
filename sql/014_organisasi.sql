-- ============================================================================
-- 014_organisasi.sql  — LEVEL ORGANISASI (di atas klub)
-- ============================================================================
-- Struktur:  PLATFORM -> ORGANISASI -> KLUB (satu cabang olahraga per klub) -> ANGGOTA
--
-- Kenapa organisasi, bukan "owner semua klub":
--   * satu orang bisa memayungi beberapa klub (pingpong + badminton + padel)
--     TANPA diberi akses ke klub milik orang lain;
--   * role klub tetap per klub (least privilege);
--   * menambah cabang olahraga baru = menambah klub baru di organisasi yang sama.
--
-- Sifat: ADITIF & IDEMPOTENT. Tidak menghapus data.
-- Jalankan SETELAH 010 & 011.
-- ============================================================================

-- ---------------------------------------------------------------- tabel organisasi
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.organizations add constraint organizations_status_check
    check (status in ('active', 'archived', 'disabled'));
exception when duplicate_object then null; end $$;

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'org_admin',
  status text not null default 'active',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

do $$ begin
  alter table public.organization_members add constraint organization_members_role_check
    check (role in ('org_owner', 'org_admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.organization_members add constraint organization_members_status_check
    check (status in ('invited', 'active', 'suspended', 'left'));
exception when duplicate_object then null; end $$;

create index if not exists organization_members_user_idx on public.organization_members (user_id);

-- ---------------------------------------------------------------- klub milik organisasi
alter table public.clubs add column if not exists organization_id uuid
  references public.organizations(id) on delete restrict;
create index if not exists clubs_organization_idx on public.clubs (organization_id);

-- Klub lama (kalau ada) dipasang ke organisasi default supaya tidak menggantung.
do $$
declare v_org uuid; v_jml int;
begin
  select count(*) into v_jml from public.clubs where organization_id is null;
  if v_jml > 0 then
    select id into v_org from public.organizations where slug = 'organisasi-utama';
    if v_org is null then
      insert into public.organizations (name, slug)
      values ('Organisasi Utama', 'organisasi-utama')
      returning id into v_org;
      raise notice 'Organisasi default dibuat (organisasi-utama).';
    end if;
    update public.clubs set organization_id = v_org where organization_id is null;
    raise notice '% klub lama dipasang ke organisasi utama.', v_jml;
  end if;
end $$;

-- CATATAN: organization_id sengaja BELUM dibuat NOT NULL.
-- Aplikasi versi sekarang belum mengirim organization_id saat membuat klub;
-- NOT NULL diberlakukan pada fase 4 setelah klien diperbarui (RPC buat_klub).

-- ---------------------------------------------------------------- cabang olahraga per turnamen
-- Opsional: kalau NULL, aturan diambil dari club_sport_settings klub.
-- Ini yang membuat satu klub kelak bisa menggelar lebih dari satu cabang olahraga.
alter table public.tournaments add column if not exists sport_id uuid
  references public.sports(id) on delete set null;

-- audit log boleh mencatat event tingkat organisasi
alter table public.audit_logs add column if not exists organization_id uuid
  references public.organizations(id) on delete set null;

-- ---------------------------------------------------------------- trigger updated_at
do $$
declare t text;
begin
  foreach t in array array['organizations', 'organization_members']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------- permission level organisasi
-- org_owner  = setara owner di SEMUA klub dalam organisasinya
-- org_admin  = setara admin di SEMUA klub dalam organisasinya
-- Keduanya TIDAK otomatis punya akses ke klub organisasi lain.
create or replace function public.org_role_has_perm(p_role text, p_perm text)
returns boolean
language sql immutable
as $$
  select case p_role
    when 'org_owner' then p_perm in (
      'club.read','club.update','club.manage_members','club.manage_roles',
      'competition.read','competition.create','competition.update','competition.delete',
      'match.read','match.manage','score.read','score.submit','score.finalize','audit.read')
    when 'org_admin' then p_perm in (
      'club.read','club.manage_members',
      'competition.read','competition.create','competition.update','competition.delete',
      'match.read','match.manage','score.read','score.submit','score.finalize')
    else false
  end
$$;

-- has_perm: izin dari KEANGGOTAAN KLUB ATAU dari KEANGGOTAAN ORGANISASI
create or replace function public.has_perm(p_club uuid, p_perm text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.club_members cm
      join public.profiles p on p.user_id = cm.user_id
      where cm.club_id = p_club
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and p.status = 'active'
        and public.role_has_perm(cm.role, p_perm)
    )
    or exists (
      select 1
      from public.clubs c
      join public.organization_members om on om.organization_id = c.organization_id
      join public.profiles p on p.user_id = om.user_id
      where c.id = p_club
        and om.user_id = auth.uid()
        and om.status = 'active'
        and p.status = 'active'
        and public.org_role_has_perm(om.role, p_perm)
    )
$$;

create or replace function public.is_club_member(p_club uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1 from public.club_members cm
      join public.profiles p on p.user_id = cm.user_id
      where cm.club_id = p_club and cm.user_id = auth.uid()
        and cm.status = 'active' and p.status = 'active'
    )
    or exists (
      select 1 from public.clubs c
      join public.organization_members om on om.organization_id = c.organization_id
      join public.profiles p on p.user_id = om.user_id
      where c.id = p_club and om.user_id = auth.uid()
        and om.status = 'active' and p.status = 'active'
    )
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organization_members om
    join public.profiles p on p.user_id = om.user_id
    where om.organization_id = p_org and om.user_id = auth.uid()
      and om.status = 'active' and p.status = 'active'
  )
$$;

create or replace function public.is_org_owner(p_org uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organization_members om
    join public.profiles p on p.user_id = om.user_id
    where om.organization_id = p_org and om.user_id = auth.uid()
      and om.status = 'active' and p.status = 'active' and om.role = 'org_owner'
  )
$$;

-- Daftar klub yang bisa diakses (langsung atau lewat organisasi).
-- `via` memberitahu klien asal izin: 'klub' atau 'organisasi'.
drop function if exists public.my_clubs();
create function public.my_clubs()
returns table (club_id uuid, club_name text, role text, via text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select c.id, c.name,
         coalesce(cm.role, om.role),
         case when cm.id is not null then 'klub' else 'organisasi' end
  from public.clubs c
  join public.profiles p on p.user_id = auth.uid() and p.status = 'active'
  left join public.club_members cm
         on cm.club_id = c.id and cm.user_id = auth.uid() and cm.status = 'active'
  left join public.organization_members om
         on om.organization_id = c.organization_id and om.user_id = auth.uid() and om.status = 'active'
  where (cm.id is not null or om.id is not null)
    and c.status <> 'disabled'
  order by c.name
$$;

-- Daftar organisasi milik pengguna (untuk pemilih organisasi)
create or replace function public.my_organizations()
returns table (organization_id uuid, organization_name text, role text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select o.id, o.name, om.role
  from public.organization_members om
  join public.profiles p on p.user_id = om.user_id
  join public.organizations o on o.id = om.organization_id
  where om.user_id = auth.uid()
    and om.status = 'active'
    and p.status = 'active'
    and o.status <> 'disabled'
  order by o.name
$$;

revoke all on function public.org_role_has_perm(text, text) from public, anon;
revoke all on function public.has_perm(uuid, text) from public, anon;
revoke all on function public.is_club_member(uuid) from public, anon;
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.is_org_owner(uuid) from public, anon;
revoke all on function public.my_clubs() from public, anon;
revoke all on function public.my_organizations() from public, anon;

grant execute on function public.org_role_has_perm(text, text) to authenticated;
grant execute on function public.has_perm(uuid, text) to authenticated;
grant execute on function public.is_club_member(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.my_clubs() to authenticated;
grant execute on function public.my_organizations() to authenticated;

-- ---------------------------------------------------------------- keamanan tabel baru
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;

revoke all on public.organizations, public.organization_members from anon, authenticated;
