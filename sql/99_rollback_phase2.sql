-- ============================================================================
-- 99_rollback_phase2.sql
-- ============================================================================
-- Membatalkan migrasi 010-014: menghapus tabel & kolom baru.
-- TIDAK menghapus data klub/turnamen/skor.
-- PERINGATAN: user, role, organisasi, undangan, dan audit log akan hilang.
-- ============================================================================

drop trigger if exists organizations_set_updated_at on public.organizations;
drop trigger if exists organization_members_set_updated_at on public.organization_members;
drop trigger if exists clubs_set_updated_at on public.clubs;
drop trigger if exists members_set_updated_at on public.members;
drop trigger if exists tournaments_set_updated_at on public.tournaments;
drop trigger if exists participants_set_updated_at on public.participants;
drop trigger if exists knockout_matches_set_updated_at on public.knockout_matches;
drop trigger if exists americano_matches_set_updated_at on public.americano_matches;
drop trigger if exists league_matches_set_updated_at on public.league_matches;

drop function if exists public.my_organizations();
drop function if exists public.my_clubs();
drop function if exists public.is_org_owner(uuid);
drop function if exists public.is_org_member(uuid);
drop function if exists public.is_platform_admin();
drop function if exists public.is_club_member(uuid);
drop function if exists public.has_perm(uuid, text);
drop function if exists public.org_role_has_perm(text, text);
drop function if exists public.role_has_perm(text, text);
drop function if exists public.set_updated_at();

drop table if exists public.audit_logs;
drop table if exists public.platform_admins;
drop table if exists public.club_invitations;
drop table if exists public.club_sport_settings;
drop table if exists public.club_members;
drop table if exists public.organization_members;
drop table if exists public.organizations;
drop table if exists public.sports;
drop table if exists public.profiles;

alter table public.clubs drop column if exists slug;
alter table public.clubs drop column if exists description;
alter table public.clubs drop column if exists status;
alter table public.clubs drop column if exists created_by;
alter table public.clubs drop column if exists updated_at;
alter table public.clubs drop column if exists organization_id;

alter table public.members drop column if exists user_id;
alter table public.members drop column if exists updated_at;

alter table public.tournaments drop column if exists created_by;
alter table public.tournaments drop column if exists updated_at;
alter table public.tournaments drop column if exists sport_id;
alter table public.participants drop column if exists updated_at;
alter table public.knockout_matches drop column if exists updated_at;
alter table public.americano_matches drop column if exists updated_at;
alter table public.league_matches drop column if exists updated_at;

-- Catatan: CHECK pingpong (target_points/best_of/match_duration) tidak dipulihkan otomatis.
-- Kalau perlu, jalankan ulang blok terkait di supabase/schema.sql.
-- Kalau ingin helper versi lama (tanpa organisasi), jalankan ulang sql/011_helpers.sql.
