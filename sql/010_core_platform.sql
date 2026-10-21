-- ============================================================================
-- 010_core_platform.sql
-- ============================================================================
-- Menambah fondasi platform: profil pengguna, keanggotaan klub (role), undangan,
-- referensi cabang olahraga, konfigurasi olahraga klub, audit log, platform admin.
--
-- Sifat: ADITIF & IDEMPOTENT (aman dijalankan berulang). Tidak menghapus data.
-- Aplikasi versi sekarang tetap berjalan setelah migrasi ini (belum ada RLS ketat).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- cabang olahraga
create table if not exists public.sports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.sports (slug, name) values
  ('table_tennis', 'Tenis Meja'),
  ('badminton', 'Bulu Tangkis'),
  ('padel', 'Padel')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- profil pengguna
-- Satu baris per akun Supabase Auth. Tidak menyimpan password apa pun.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.profiles add constraint profiles_status_check
    check (status in ('active', 'disabled'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- clubs: kolom baru
alter table public.clubs add column if not exists slug text;
alter table public.clubs add column if not exists description text;
alter table public.clubs add column if not exists status text not null default 'active';
alter table public.clubs add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.clubs add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.clubs add constraint clubs_status_check
    check (status in ('active', 'archived', 'disabled'));
exception when duplicate_object then null; end $$;

-- slug unik (NULL boleh lebih dari satu) + backfill dari nama
create unique index if not exists clubs_slug_key on public.clubs (slug);

with s as (
  select id, lower(regexp_replace(btrim(name), '[^a-zA-Z0-9]+', '-', 'g')) as dasar,
         row_number() over (partition by lower(regexp_replace(btrim(name), '[^a-zA-Z0-9]+', '-', 'g')) order by created_at) as urut
  from public.clubs
  where slug is null
)
update public.clubs c
set slug = case when s.urut = 1 then trim(both '-' from s.dasar)
                else trim(both '-' from s.dasar) || '-' || s.urut end
from s where s.id = c.id;

-- ---------------------------------------------------------------- keanggotaan klub
create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id)
);

do $$ begin
  alter table public.club_members add constraint club_members_role_check
    check (role in ('owner', 'admin', 'official', 'member'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.club_members add constraint club_members_status_check
    check (status in ('invited', 'active', 'suspended', 'left'));
exception when duplicate_object then null; end $$;

create index if not exists club_members_user_idx on public.club_members (user_id);

-- ---------------------------------------------------------------- undangan
create table if not exists public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.club_invitations add constraint club_invitations_role_check
    check (role in ('owner', 'admin', 'official', 'member'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.club_invitations add constraint club_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired'));
exception when duplicate_object then null; end $$;

-- satu undangan pending per (klub, email)
create unique index if not exists club_invitations_pending_key
  on public.club_invitations (club_id, lower(email)) where status = 'pending';

-- ---------------------------------------------------------------- konfigurasi olahraga klub
-- Aturan spesifik cabang olahraga disimpan di sini (JSON), bukan di CHECK constraint.
create table if not exists public.club_sport_settings (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  sport_id uuid not null references public.sports(id),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- audit log
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_club_idx on public.audit_logs (club_id, created_at desc);

-- ---------------------------------------------------------------- platform admin (via SQL saja)
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- domain: kolom tambahan
-- Pemain (members) boleh dikaitkan ke akun. Karena keputusan: pemain WAJIB punya akun,
-- kolom ini akan dijadikan NOT NULL pada migrasi 020 setelah semua pemain punya akun.
alter table public.members add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.members add column if not exists updated_at timestamptz not null default now();
create unique index if not exists members_club_user_key on public.members (club_id, user_id) where user_id is not null;

alter table public.tournaments add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.tournaments add column if not exists updated_at timestamptz not null default now();

alter table public.participants add column if not exists updated_at timestamptz not null default now();
alter table public.knockout_matches add column if not exists updated_at timestamptz not null default now();
alter table public.americano_matches add column if not exists updated_at timestamptz not null default now();
alter table public.league_matches add column if not exists updated_at timestamptz not null default now();

-- ------------------------------------------- longgarkan CHECK khusus tenis meja
-- target_points / best_of / durasi berbeda per cabang olahraga (padel memakai set/game),
-- jadi pindah ke public.club_sport_settings(settings jsonb).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.tournaments'::regclass and contype = 'c'
      and (conname like '%target_points%' or conname like '%best_of%' or conname like '%match_duration%')
  loop
    execute format('alter table public.tournaments drop constraint %I', c.conname);
    raise notice 'CHECK dilepas: %', c.conname;
  end loop;
end $$;

-- ---------------------------------------------------------------- trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'clubs', 'members', 'tournaments', 'participants',
    'knockout_matches', 'americano_matches', 'league_matches',
    'profiles', 'club_members', 'club_sport_settings'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'updated_at'
    ) then
      execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        t || '_set_updated_at', t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- keamanan tabel baru
-- Tabel baru: RLS aktif TANPA policy + cabut grant anon/authenticated.
-- Artinya: tertutup total dari API sampai policy-nya ditulis di fase 4.
alter table public.profiles            enable row level security;
alter table public.sports              enable row level security;
alter table public.club_members        enable row level security;
alter table public.club_invitations    enable row level security;
alter table public.club_sport_settings enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.platform_admins     enable row level security;

revoke all on
  public.profiles, public.sports, public.club_members, public.club_invitations,
  public.club_sport_settings, public.audit_logs, public.platform_admins
from anon, authenticated;

-- 9 tabel lama BELUM diubah policy-nya di langkah ini (aplikasi masih jalan apa adanya).
