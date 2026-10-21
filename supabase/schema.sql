-- ============================================================================
-- Pingpong Club Manager — skema database Supabase
-- ============================================================================
-- ⚠️ FILE BASELINE (versi awal tanpa login). JANGAN dipakai untuk database baru
--    setelah migrasi keamanan. Skema terbaru = file berurutan di ../sql/ :
--      010_core_platform.sql -> 011_helpers.sql -> 014_organisasi.sql -> 012_bootstrap_owner.sql
--    Penjelasan lengkap: ../docs/migrasi/README.md
-- ============================================================================
-- Cara pakai:
--   1. Buat project gratis di https://supabase.com
--   2. Buka SQL Editor -> New query -> tempel seluruh isi file ini -> Run
--   3. Salin Project URL + anon public key (Project Settings -> API) ke file .env
--
-- CATATAN KEAMANAN (penting, karena aplikasi ini tanpa login):
--   Aplikasi tidak memakai login, jadi seluruh akses memakai kunci "anon" yang
--   ikut terkirim ke browser. Policy di bawah membuat siapa pun yang tahu URL
--   aplikasi bisa membaca DAN mengubah data. Jangan simpan data sensitif di sini.
--   JANGAN gunakan service_role key di frontend — kunci itu melewati semua policy.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- klub & anggota
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  photo_url text,
  gender text not null check (gender in ('L', 'P')),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists members_club_idx on public.members(club_id);

-- ------------------------------------------------------------------- turnamen
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  date date not null,
  type text not null check (type in ('knockout', 'americano', 'liga')),
  format text check (format in ('single', 'double')),
  best_of integer check (best_of in (3, 5)),
  target_points integer check (target_points in (11, 15, 21, 24)),
  match_duration_min integer check (match_duration_min between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'ongoing', 'finished')),
  created_at timestamptz not null default now(),
  -- khusus liga
  date_end date,
  rounds_planned integer check (rounds_planned is null or rounds_planned between 1 and 60),
  -- knockout wajib format + best_of; americano wajib target poin
  constraint tournaments_knockout_lengkap check (
    type <> 'knockout' or (format is not null and best_of is not null)
  ),
  constraint tournaments_americano_lengkap check (
    type <> 'americano' or target_points is not null
  ),
  -- liga wajib format + target poin (tanggal selesai diisi aplikasi)
  constraint tournaments_liga_lengkap check (
    type <> 'liga' or (format is not null and target_points is not null)
  )
);
create index if not exists tournaments_club_idx on public.tournaments(club_id);

-- peserta: single = 1 anggota, double = 2 anggota (member_ids)
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  label text not null,
  member_ids jsonb not null default '[]'::jsonb
);
create index if not exists participants_tournament_idx on public.participants(tournament_id);

-- ------------------------------------------------------------------- knockout
create table if not exists public.knockout_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round integer not null check (round >= 1),
  position integer not null check (position >= 0),
  participant_a uuid,
  participant_b uuid,
  games jsonb not null default '[]'::jsonb,
  winner_id uuid,
  next_match_id uuid,
  next_slot text check (next_slot in ('a', 'b')),
  unique (tournament_id, round, position)
);
create index if not exists knockout_matches_tournament_idx on public.knockout_matches(tournament_id);

-- ------------------------------------------------------------------ americano
create table if not exists public.americano_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_no integer not null check (round_no >= 1),
  unique (tournament_id, round_no)
);

create table if not exists public.americano_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_id uuid not null references public.americano_rounds(id) on delete cascade,
  round_no integer not null,
  table_no integer not null default 1,
  team_a jsonb not null,
  team_b jsonb not null,
  score_a integer check (score_a is null or (score_a >= 0 and score_a <= 99)),
  score_b integer check (score_b is null or (score_b >= 0 and score_b <= 99))
);
create index if not exists americano_matches_tournament_idx on public.americano_matches(tournament_id);

-- ---------------------------------------------------------------------- liga
create table if not exists public.league_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_no integer not null check (round_no >= 1),
  unique (tournament_id, round_no)
);

create table if not exists public.league_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_id uuid not null references public.league_rounds(id) on delete cascade,
  round_no integer not null,
  court_no integer not null default 1,
  team_a jsonb not null,
  team_b jsonb not null,
  score_a integer check (score_a is null or (score_a >= 0 and score_a <= 99)),
  score_b integer check (score_b is null or (score_b >= 0 and score_b <= 99))
);
create index if not exists league_matches_tournament_idx on public.league_matches(tournament_id);

-- =============================================== migrasi untuk database lama
-- Aman dijalankan ulang: hanya menambah kolom/constraint yang belum ada.
alter table public.members add column if not exists aktif boolean not null default true;
alter table public.tournaments add column if not exists date_end date;
alter table public.tournaments add column if not exists rounds_planned integer;

do $$
begin
  alter table public.tournaments drop constraint if exists tournaments_type_check;
  alter table public.tournaments add constraint tournaments_type_check
    check (type in ('knockout', 'americano', 'liga'));
exception when others then null;
end $$;

do $$
begin
  alter table public.tournaments drop constraint if exists tournaments_liga_lengkap;
  alter table public.tournaments add constraint tournaments_liga_lengkap
    check (type <> 'liga' or (format is not null and target_points is not null));
exception when others then null;
end $$;

-- =========================================================== Row Level Security
-- Tanpa login: role anon diberi akses penuh ke tabel-tabel aplikasi.
alter table public.clubs enable row level security;
alter table public.members enable row level security;
alter table public.tournaments enable row level security;
alter table public.participants enable row level security;
alter table public.knockout_matches enable row level security;
alter table public.americano_rounds enable row level security;
alter table public.americano_matches enable row level security;
alter table public.league_rounds enable row level security;
alter table public.league_matches enable row level security;

grant select, insert, update, delete on
  public.clubs, public.members, public.tournaments, public.participants,
  public.knockout_matches, public.americano_rounds, public.americano_matches,
  public.league_rounds, public.league_matches
to anon;

do $$
declare
  t text;
begin
  foreach t in array array[
    'clubs', 'members', 'tournaments', 'participants',
    'knockout_matches', 'americano_rounds', 'americano_matches',
    'league_rounds', 'league_matches'
  ]
  loop
    execute format('drop policy if exists "%s_akses_anon" on public.%I', t, t);
    execute format(
      'create policy "%s_akses_anon" on public.%I for all to anon using (true) with check (true)',
      t, t
    );
  end loop;
end $$;
