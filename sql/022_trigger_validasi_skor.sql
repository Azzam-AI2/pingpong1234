-- ============================================================================
-- 022_trigger_validasi_skor.sql — VALIDASI SKOR DI DATABASE
-- ============================================================================
-- Tujuan: skor dan pemenang TIDAK lagi ditentukan oleh klien.
-- Trigger di bawah memeriksa aturan cabang olahraga + konfigurasi kompetisi,
-- lalu MENGHITUNG SENDIRI pemenang pertandingan. Klien yang mengirim
-- winner_id palsu atau skor tidak sah akan ditolak / dikoreksi database.
--
-- Idempotent: fungsi & trigger dibuat ulang.
-- ============================================================================

-- ---------------------------------------------------------------- aturan kompetisi
create or replace function public.aturan_turnamen(p_turnamen uuid)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when c.sport_slug = 'badminton' then
      jsonb_build_object('jenis', 'poin', 'target', 21, 'selisihMin', 2, 'batasMaks', 30)
    when c.sport_slug = 'padel' and t.type = 'americano' then
      jsonb_build_object(
        'jenis', 'americano',
        'target', coalesce((t.settings ->> 'target')::int, t.target_points, 16)
      )
    when c.sport_slug = 'padel' then
      jsonb_build_object(
        'jenis', 'set',
        'gamePerSet', 6,
        'selisihMin', 2,
        'maksGame', 7,
        'tiebreak', coalesce((t.settings ->> 'tiebreak')::boolean, true),
        'goldenPoint', coalesce((t.settings ->> 'goldenPoint')::boolean, false)
      )
    else
      jsonb_build_object('jenis', 'poin', 'target', 11, 'selisihMin', 1)
  end
  from public.tournaments t
  join public.clubs c on c.id = t.club_id
  where t.id = p_turnamen
$$;

-- ---------------------------------------------------------------- validasi satu game/set
create or replace function public.validasi_game_skor(p_aturan jsonb, p_a int, p_b int)
returns text
language plpgsql immutable
as $$
declare
  v_jenis text := p_aturan ->> 'jenis';
  v_target int := (p_aturan ->> 'target')::int;
  v_selisih int := coalesce((p_aturan ->> 'selisihMin')::int, 1);
  v_batas int := (p_aturan ->> 'batasMaks')::int;
  v_gps int := (p_aturan ->> 'gamePerSet')::int;
  v_maks int := (p_aturan ->> 'maksGame')::int;
  v_tb boolean := coalesce((p_aturan ->> 'tiebreak')::boolean, true);
  v_tinggi int;
begin
  if p_a is null or p_b is null then return 'Skor belum lengkap.'; end if;
  if p_a < 0 or p_b < 0 then return 'Skor tidak boleh negatif.'; end if;

  if v_jenis = 'americano' then
    if p_a > v_target or p_b > v_target then
      return format('Skor maksimal %s poin.', v_target);
    end if;
    return null;
  end if;

  v_tinggi := greatest(p_a, p_b);

  if v_jenis = 'set' then
    if v_tinggi > v_maks then return format('Skor game maksimal %s.', v_maks); end if;
    if p_a = v_maks and p_b = v_maks then return format('Tidak boleh %s-%s.', v_maks, v_maks); end if;
    if v_tinggi = v_maks then
      if not v_tb and least(p_a, p_b) >= v_gps then
        return format('Set %s-%s hanya boleh kalau tiebreak diaktifkan.', v_maks, v_gps);
      end if;
      return null;
    end if;
    if p_a = p_b then return 'Skor tidak boleh seri.'; end if;
    if v_tinggi >= v_gps and abs(p_a - p_b) >= v_selisih then return null; end if;
    return format('Set belum selesai: butuh %s game dengan selisih %s.', v_gps, v_selisih);
  end if;

  -- aturan poin
  if p_a = p_b then return 'Skor tidak boleh seri.'; end if;
  if v_batas is not null and v_tinggi > v_batas then
    return format('Skor maksimal %s poin.', v_batas);
  end if;
  if v_selisih = 1 then
    if v_tinggi <> v_target then return format('Pemenang harus tepat %s poin.', v_target); end if;
    return null;
  end if;
  if v_tinggi >= v_target then
    if v_batas is not null and v_tinggi = v_batas then return null; end if;
    if abs(p_a - p_b) >= v_selisih then return null; end if;
    return format('Pada %s-%s harus unggul %s poin.', v_target, v_target, v_selisih);
  end if;
  return format('Game belum selesai: minimal %s poin.', v_target);
end $$;

create or replace function public.pemenang_game_skor(p_aturan jsonb, p_a int, p_b int)
returns text
language plpgsql immutable
as $$
begin
  if public.validasi_game_skor(p_aturan, p_a, p_b) is not null then return null; end if;
  if p_a = p_b then return null; end if;
  return case when p_a > p_b then 'a' else 'b' end;
end $$;

-- ---------------------------------------------------------------- trigger bagan knockout
create or replace function public.trg_validasi_bagan()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_aturan jsonb;
  v_best_of int;
  v_butuh int;
  v_game jsonb;
  v_err text;
  v_menang text;
  v_a int := 0;
  v_b int := 0;
begin
  select coalesce(t.best_of, 3) into v_best_of
  from public.tournaments t where t.id = new.tournament_id;
  v_best_of := coalesce(v_best_of, 3);
  v_butuh := (v_best_of / 2) + 1;
  v_aturan := public.aturan_turnamen(new.tournament_id);

  -- skor dikosongkan = hasil dibatalkan
  if new.games is null or jsonb_array_length(new.games) = 0 then
    new.winner_id := null;
    return new;
  end if;

  if jsonb_array_length(new.games) > v_best_of then
    raise exception 'Jumlah game (%) melebihi best of %.', jsonb_array_length(new.games), v_best_of;
  end if;

  for v_game in select * from jsonb_array_elements(new.games) loop
    v_err := public.validasi_game_skor(
      v_aturan,
      nullif(v_game ->> 'a', '')::int,
      nullif(v_game ->> 'b', '')::int
    );
    if v_err is not null then
      raise exception '%', v_err;
    end if;
    v_menang := public.pemenang_game_skor(
      v_aturan,
      (v_game ->> 'a')::int,
      (v_game ->> 'b')::int
    );
    if v_menang = 'a' then v_a := v_a + 1;
    elsif v_menang = 'b' then v_b := v_b + 1;
    end if;
  end loop;

  -- pemenang selalu dihitung database, bukan dari klien
  if v_a >= v_butuh then
    new.winner_id := new.participant_a;
  elsif v_b >= v_butuh then
    new.winner_id := new.participant_b;
  else
    new.winner_id := null;
  end if;

  return new;
end $$;

drop trigger if exists validasi_skor_bagan on public.knockout_matches;
create trigger validasi_skor_bagan
  before insert or update on public.knockout_matches
  for each row execute function public.trg_validasi_bagan();

-- ---------------------------------------------------------------- trigger skor liga
create or replace function public.trg_validasi_skor_liga()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_aturan jsonb := public.aturan_turnamen(new.tournament_id);
  v_err text;
begin
  if new.score_a is null and new.score_b is null then return new; end if;
  if (new.score_a is null) <> (new.score_b is null) then
    raise exception 'Isi kedua skor, atau kosongkan keduanya.';
  end if;
  v_err := public.validasi_game_skor(v_aturan, new.score_a, new.score_b);
  if v_err is not null then raise exception '%', v_err; end if;
  return new;
end $$;

drop trigger if exists validasi_skor_liga on public.league_matches;
create trigger validasi_skor_liga
  before insert or update on public.league_matches
  for each row execute function public.trg_validasi_skor_liga();

-- ---------------------------------------------------------------- trigger skor americano
create or replace function public.trg_validasi_skor_americano()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_aturan jsonb := public.aturan_turnamen(new.tournament_id);
  v_err text;
begin
  if new.score_a is null and new.score_b is null then return new; end if;
  if (new.score_a is null) <> (new.score_b is null) then
    raise exception 'Isi kedua skor, atau kosongkan keduanya.';
  end if;
  v_err := public.validasi_game_skor(v_aturan, new.score_a, new.score_b);
  if v_err is not null then raise exception '%', v_err; end if;
  return new;
end $$;

drop trigger if exists validasi_skor_americano on public.americano_matches;
create trigger validasi_skor_americano
  before insert or update on public.americano_matches
  for each row execute function public.trg_validasi_skor_americano();

revoke all on function public.aturan_turnamen(uuid) from public, anon;
revoke all on function public.validasi_game_skor(jsonb, int, int) from public, anon;
revoke all on function public.pemenang_game_skor(jsonb, int, int) from public, anon;
grant execute on function public.aturan_turnamen(uuid) to authenticated;
grant execute on function public.validasi_game_skor(jsonb, int, int) to authenticated;
grant execute on function public.pemenang_game_skor(jsonb, int, int) to authenticated;

-- ============================================================================
-- Rollback: sql/022_rollback.sql
-- ============================================================================
