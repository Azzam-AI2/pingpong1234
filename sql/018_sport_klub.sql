-- ============================================================================
-- 018_sport_klub.sql — JENIS OLAHRAGA PADA KLUB
-- ============================================================================
-- Menyimpan cabang olahraga klub langsung di tabel clubs supaya aplikasi bisa
-- membacanya bersama data klub (satu query), sementara aturan detail tetap di
-- club_sport_settings.settings.
--
-- Perilaku tenis meja tidak berubah: semua klub lama otomatis 'table_tennis'.
-- Idempotent & aditif.
-- ============================================================================

alter table public.clubs add column if not exists sport_slug text not null default 'table_tennis';

-- Nilai harus salah satu cabang yang terdaftar di public.sports
do $$ begin
  alter table public.clubs
    add constraint clubs_sport_slug_fk foreign key (sport_slug) references public.sports(slug)
    on update cascade;
exception when duplicate_object then null; end $$;

-- Klub lama: pastikan bertenis meja
update public.clubs set sport_slug = 'table_tennis' where sport_slug is null or sport_slug = '';

-- Sinkronkan konfigurasi olahraga untuk setiap klub yang belum punya
insert into public.club_sport_settings (club_id, sport_id)
select c.id, s.id
from public.clubs c
join public.sports s on s.slug = c.sport_slug
on conflict (club_id) do nothing;

create index if not exists clubs_sport_idx on public.clubs (sport_slug);

-- Catatan migrasi:
--  * Tidak ada kolom yang dihapus atau diubah tipenya.
--  * Rollback: `alter table public.clubs drop constraint clubs_sport_slug_fk;
--               alter table public.clubs drop column if exists sport_slug;
--               drop index if exists clubs_sport_idx;`
