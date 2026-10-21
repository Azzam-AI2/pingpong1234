-- ============================================================================
-- 019_settings_kompetisi.sql — KONFIGURASI ATURAN PER KOMPETISI
-- ============================================================================
-- Menyimpan aturan yang dipilih penyelenggara untuk satu kompetisi, supaya
-- semua pertandingan dalam kompetisi itu memakai aturan yang sama.
--
-- Contoh isi settings:
--   padel knockout : {"tiebreak": true, "goldenPoint": true}
--   bulu tangkis   : {"target": 21, "batasMaks": 30}
--   americano      : {"target": 15}
--
-- Aturan detail tetap dipakai lewat mesin skor di klien; nilai default cabang
-- dipakai bila settings kosong. Idempotent & aditif.
-- ============================================================================

alter table public.tournaments
  add column if not exists settings jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.tournaments add constraint tournaments_settings_objek
    check (jsonb_typeof(settings) = 'object');
exception when duplicate_object then null; end $$;

-- Kompetisi lama: pastikan objek kosong (bukan null)
update public.tournaments set settings = '{}'::jsonb where settings is null;

comment on column public.tournaments.settings is
  'Konfigurasi aturan kompetisi (target poin, tiebreak, golden point). Kosong = pakai default cabang klub.';

-- Rollback:
--   alter table public.tournaments drop constraint if exists tournaments_settings_objek;
--   alter table public.tournaments drop column if exists settings;
