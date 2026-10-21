import { describe, expect, it } from 'vitest'
import { pangkasYatim, snapshotKosong, terapkanKeSnapshot } from '../storage/mirror'
import type { Snapshot } from '../types'

function dasar(): Snapshot {
  const s = snapshotKosong()
  s.clubs.push({ id: 'c1', name: 'Klub', logo_url: null, created_at: '2026-01-01' })
  s.tournaments.push({
    id: 't1',
    club_id: 'c1',
    name: 'Liga Uji',
    date: '2026-01-01',
    type: 'liga',
    format: 'single',
    best_of: null,
    target_points: 11,
    match_duration_min: null,
    status: 'draft',
    created_at: '2026-01-01',
    date_end: '2026-02-01',
    rounds_planned: null,
  })
  return s
}

const rondeLiga = { id: 'rl1', tournament_id: 't1', round_no: 1 }
const matchLiga = {
  id: 'ml1',
  tournament_id: 't1',
  round_id: 'rl1',
  round_no: 1,
  court_no: 1,
  team_a: ['m1'],
  team_b: ['m2'],
  score_a: null,
  score_b: null,
}

describe('mirror snapshot', () => {
  it('menyimpan match liga yang rondenya ada (tidak terbuang saat pangkas)', () => {
    const setelah = terapkanKeSnapshot(dasar(), [
      { table: 'league_rounds', type: 'insert', row: rondeLiga },
      { table: 'league_matches', type: 'insert', row: matchLiga },
    ])
    expect(setelah.league_rounds).toHaveLength(1)
    expect(setelah.league_matches).toHaveLength(1)
    // ronde americano tidak dipakai untuk memangkas match liga
    expect(setelah.americano_rounds).toHaveLength(0)
    expect(setelah.americano_matches).toHaveLength(0)
  })

  it('membuang match liga yang rondenya sudah hilang, tanpa menyentuh match americano', () => {
    const s = dasar()
    s.league_rounds.push(rondeLiga)
    s.league_matches.push(matchLiga)
    s.americano_rounds.push({ id: 'ra1', tournament_id: 't1', round_no: 1 })
    s.americano_matches.push({
      id: 'ma1',
      tournament_id: 't1',
      round_id: 'ra1',
      round_no: 1,
      table_no: 1,
      team_a: ['m1', 'm2'],
      team_b: ['m3', 'm4'],
      score_a: null,
      score_b: null,
    })

    const utuh = pangkasYatim(s)
    expect(utuh.league_matches).toHaveLength(1)
    expect(utuh.americano_matches).toHaveLength(1)

    const tanpaRondeLiga: Snapshot = { ...s, league_rounds: [] }
    const dipangkas = pangkasYatim(tanpaRondeLiga)
    expect(dipangkas.league_matches).toHaveLength(0)
    expect(dipangkas.americano_matches).toHaveLength(1)
  })

  it('membuang baris yang klub/turnamen induknya sudah hilang', () => {
    const s = dasar()
    s.league_rounds.push(rondeLiga)
    s.league_matches.push(matchLiga)
    s.members.push({
      id: 'm1',
      club_id: 'c-hilang',
      name: 'X',
      photo_url: null,
      gender: 'L',
      created_at: '2026-01-01',
    })
    const bersih = pangkasYatim(s)
    expect(bersih.members).toHaveLength(0)
  })
})
