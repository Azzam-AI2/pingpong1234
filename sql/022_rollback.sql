-- ============================================================================
-- 022_rollback.sql — cabut validasi skor di database
-- ============================================================================

drop trigger if exists validasi_skor_bagan on public.knockout_matches;
drop trigger if exists validasi_skor_liga on public.league_matches;
drop trigger if exists validasi_skor_americano on public.americano_matches;

drop function if exists public.trg_validasi_bagan();
drop function if exists public.trg_validasi_skor_liga();
drop function if exists public.trg_validasi_skor_americano();
drop function if exists public.pemenang_game_skor(jsonb, int, int);
drop function if exists public.validasi_game_skor(jsonb, int, int);
drop function if exists public.aturan_turnamen(uuid);
