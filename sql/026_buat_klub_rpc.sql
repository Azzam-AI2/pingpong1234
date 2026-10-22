-- ============================================================================
-- 026_buat_klub_rpc.sql — PEMBUATAN KLUB ATOMIK (+ owner otomatis)
-- ============================================================================
-- BUG yang diperbaiki: klien hanya menyisipkan baris di tabel clubs, tanpa
-- membuat keanggotaan. Karena policy baca clubs memakai is_club_member(id),
-- klub baru tidak terlihat lagi setelah halaman dimuat ulang (dan tidak ada
-- satu pun owner-nya).
--
-- RPC ini membuat klub + keanggotaan owner + konfigurasi cabang + audit log
-- dalam SATU transaksi. Kalau salah satu gagal, semuanya dibatalkan.
-- Idempotent.
-- ============================================================================

create or replace function public.buat_klub(
  p_name text,
  p_logo text default null,
  p_sport_slug text default 'table_tennis'
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_sport text := coalesce(nullif(btrim(p_sport_slug), ''), 'table_tennis');
  v_nama text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'Harus masuk dulu untuk membuat klub.';
  end if;

  if not public.boleh_buat_klub() then
    raise exception 'Kamu tidak berwenang membuat klub. Hubungi pemilik platform atau pemilik organisasi.';
  end if;

  if v_nama = '' then
    raise exception 'Nama klub wajib diisi.';
  end if;

  if not exists (select 1 from public.sports s where s.slug = v_sport) then
    raise exception 'Cabang olahraga "%" tidak dikenal.', v_sport;
  end if;

  insert into public.clubs (name, logo_url, sport_slug, created_by, status)
  values (v_nama, p_logo, v_sport, v_uid, 'active')
  returning id into v_id;

  -- Pembuat langsung menjadi owner aktif: klub tidak boleh tanpa pemilik.
  insert into public.club_members (club_id, user_id, role, status, joined_at)
  values (v_id, v_uid, 'owner', 'active', now())
  on conflict (club_id, user_id) do update
    set role = 'owner', status = 'active';

  insert into public.club_sport_settings (club_id, sport_id)
  select v_id, s.id from public.sports s where s.slug = v_sport
  on conflict (club_id) do nothing;

  insert into public.audit_logs (actor_user_id, club_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_id, 'klub_dibuat', 'club', v_id::text,
          jsonb_build_object('nama', v_nama, 'cabang', v_sport));

  return v_id;
end $$;

revoke all on function public.buat_klub(text, text, text) from public, anon;
grant execute on function public.buat_klub(text, text, text) to authenticated;

-- ---------------------------------------------------------------- klub yatim lama
-- Klub yang terlanjur dibuat tanpa keanggotaan tidak terlihat oleh siapa pun.
-- Opsi A (rekomendasi): hapus, karena isinya kosong.
--   delete from public.clubs c
--   where not exists (select 1 from public.club_members cm where cm.club_id = c.id)
--     and not exists (select 1 from public.tournaments t where t.club_id = c.id)
--     and not exists (select 1 from public.members m where m.club_id = c.id);
--
-- Opsi B: jadikan dirimu owner klub yatim itu.
--   insert into public.club_members (club_id, user_id, role, status, joined_at)
--   select c.id, (select id from auth.users where lower(email) = lower('EMAIL_KAMU')), 'owner', 'active', now()
--   from public.clubs c
--   where not exists (select 1 from public.club_members cm where cm.club_id = c.id)
--   on conflict (club_id, user_id) do nothing;

-- Rollback: drop function if exists public.buat_klub(text, text, text);
