-- ============================================================================
-- 000_bersihkan_data.sql  (OPSIONAL — hanya kalau memang mau mulai dari nol)
-- ============================================================================
-- Menghapus SELURUH data klub (klub, anggota, turnamen, peserta, skor/bagan).
-- Semua tabel anak memakai ON DELETE CASCADE, jadi cukup hapus dari clubs.
--
-- JALANKAN HANYA SETELAH CADANGAN ADA (backup/<waktu>/ dari scripts/export-db.mjs).
-- Untuk membatalkan: impor ulang dari file backup (lihat docs/migrasi/README.md).
-- ============================================================================

do $$
declare
  n_clubs int; n_members int; n_tour int; n_knock int;
begin
  select count(*) into n_clubs  from public.clubs;
  select count(*) into n_members from public.members;
  select count(*) into n_tour    from public.tournaments;
  select count(*) into n_knock   from public.knockout_matches;
  raise notice 'SEBELUM: clubs=%, members=%, tournaments=%, knockout_matches=%', n_clubs, n_members, n_tour, n_knock;
end $$;

delete from public.clubs;   -- cascade ke members, tournaments, participants, semua match & ronde

do $$
declare
  n_clubs int; n_members int; n_tour int; n_knock int;
begin
  select count(*) into n_clubs  from public.clubs;
  select count(*) into n_members from public.members;
  select count(*) into n_tour    from public.tournaments;
  select count(*) into n_knock   from public.knockout_matches;
  raise notice 'SESUDAH: clubs=%, members=%, tournaments=%, knockout_matches=%', n_clubs, n_members, n_tour, n_knock;
end $$;
