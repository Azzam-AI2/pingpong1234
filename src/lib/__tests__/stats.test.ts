import { describe, expect, it } from 'vitest'
import { drawBracket, recompute } from '../knockout'
import { hitungStatistikKlub, ringkasDashboard, urutkanStatistik } from '../stats'
import type {
  AmericanoMatch,
  AmericanoRound,
  Game,
  KnockoutMatch,
  Member,
  Participant,
  Tournament,
} from '../types'

const TGL = '2026-10-01'

function member(id: string, nama: string, club = 'c1'): Member {
  return { id, club_id: club, name: nama, photo_url: null, gender: 'L', aktif: true, created_at: TGL }
}

function turnamen(patch: Partial<Tournament> & { id: string; type: Tournament['type'] }): Tournament {
  return {
    club_id: 'c1',
    name: 'Turnamen',
    date: TGL,
    format: 'single',
    best_of: 3,
    target_points: null,
    match_duration_min: null,
    status: 'draft',
    created_at: TGL,
    ...patch,
  } as Tournament
}

function mainkan(matches: KnockoutMatch[], id: string, games: Game[]): KnockoutMatch[] {
  return recompute(matches.map((m) => (m.id === id ? { ...m, games } : m)))
}

describe('statistik klub', () => {
  const anggota = [member('a', 'Ana'), member('b', 'Budi'), member('c', 'Cici'), member('d', 'Dedi')]
  const peserta: Participant[] = anggota.map((m) => ({
    id: `pt-${m.id}`,
    tournament_id: 'tk1',
    label: m.name,
    member_ids: [m.id],
  }))
  const ko = turnamen({ id: 'tk1', type: 'knockout', name: 'Kopdar Oktober', status: 'ongoing' })

  const d = drawBracket('tk1', peserta.map((p) => p.id))
  let matches = d.matches
  const semi = matches.filter((m) => m.round === 1)

  it('menghitung menang/kalah/gelar tanpa mencampur Americano', () => {
    matches = mainkan(matches, semi[0].id, [
      { a: 11, b: 3 },
      { a: 11, b: 4 },
    ])
    matches = mainkan(matches, semi[1].id, [
      { a: 11, b: 3 },
      { a: 11, b: 4 },
    ])
    const final = matches.find((m) => m.round === 2)!
    matches = mainkan(matches, final.id, [
      { a: 11, b: 6 },
      { a: 11, b: 6 },
    ])
    const finalSelesai = matches.find((m) => m.round === 2)!

    const selesai = { ...ko, status: 'finished' as const }
    const stat = hitungStatistikKlub(anggota, [selesai], peserta, matches, [])

    const juaraFinal = finalSelesai.winner_id!
    const juaraMember = peserta.find((p) => p.id === juaraFinal)!.member_ids[0]
    expect(stat.find((s) => s.memberId === juaraMember)!.knockout.titles).toBe(1)
    expect(stat.find((s) => s.memberId === juaraMember)!.knockout.wins).toBe(2)
    // semifinalis yang kalah hanya main 1 kali
    const kalahSemi = [semi[0].id, semi[1].id]
      .map((id) => matches.find((m) => m.id === id)!)
      .map((m) => (m.winner_id === m.participant_a ? m.participant_b : m.participant_a))
      .map((pid) => peserta.find((p) => p.id === pid)!.member_ids[0])
    for (const id of kalahSemi) {
      expect(stat.find((s) => s.memberId === id)!.knockout.matches).toBe(1)
      expect(stat.find((s) => s.memberId === id)!.knockout.losses).toBe(1)
    }
    expect(stat.every((s) => s.americano.titles === 0 && s.americano.poin === 0)).toBe(true)
    expect(stat.find((s) => s.memberId === juaraMember)!.knockout.matches).toBe(2)
  })

  it('Americano memberi poin dan gelar terpisah dari Knockout', () => {
    const am = turnamen({
      id: 'ta1',
      type: 'americano',
      name: 'Americano Malam',
      format: null,
      best_of: null,
      target_points: 21,
      status: 'finished',
    })
    const ronde: AmericanoRound = { id: 'r1', tournament_id: 'ta1', round_no: 1 }
    const amMatch: AmericanoMatch = {
      id: 'am1',
      tournament_id: 'ta1',
      round_id: ronde.id,
      round_no: 1,
      table_no: 1,
      team_a: ['a', 'b'],
      team_b: ['c', 'd'],
      score_a: 21,
      score_b: 15,
    }
    const stat = hitungStatistikKlub(
      anggota,
      [turnamen({ id: 'tk1', type: 'knockout', status: 'draft' }), am],
      [],
      [],
      [amMatch],
    )
    const a = stat.find((s) => s.memberId === 'a')!
    expect(a.americano.poin).toBe(21)
    expect(a.americano.matches).toBe(1)
    expect(a.americano.wins).toBe(1)
    expect(a.knockout.matches).toBe(0)
    expect(a.americano.riwayat).toHaveLength(1)

    const c = stat.find((s) => s.memberId === 'c')!
    expect(c.americano.poin).toBe(15)
    expect(c.americano.losses).toBe(1)
  })

  it('win rate dibulatkan dari menang dan kalah saja', () => {
    const d2 = drawBracket('tk9', ['x1', 'x2', 'x3', 'x4'])
    let m2 = d2.matches
    const s1 = m2.filter((m) => m.round === 1)
    m2 = mainkan(m2, s1[0].id, [
      { a: 11, b: 0 },
      { a: 11, b: 0 },
    ])
    const pt: Participant[] = [
      { id: 'x1', tournament_id: 'tk9', label: 'X1', member_ids: ['x1'] },
      { id: 'x2', tournament_id: 'tk9', label: 'X2', member_ids: ['x2'] },
      { id: 'x3', tournament_id: 'tk9', label: 'X3', member_ids: ['x3'] },
      { id: 'x4', tournament_id: 'tk9', label: 'X4', member_ids: ['x4'] },
    ]
    const mrs = [member('x1', 'X1'), member('x2', 'X2'), member('x3', 'X3'), member('x4', 'X4')]
    const stat = hitungStatistikKlub(
      mrs,
      [turnamen({ id: 'tk9', type: 'knockout', status: 'ongoing' })],
      pt,
      m2,
      [],
    )
    const pemenangId = s1[0].participant_a!
    const s = stat.find((x) => x.memberId === pemenangId)!
    expect(s.knockout.winrate).toBe(100)
    const kalahId = s1[0].participant_b!
    expect(stat.find((x) => x.memberId === kalahId)!.knockout.winrate).toBe(0)
    // yang belum bertanding tidak muncul di urutan atas
    const urut = urutkanStatistik(stat, 'winrate')
    expect(urut[0].memberId).toBe(pemenangId)
  })
})

describe('ringkasan dashboard', () => {
  it('menghitung jumlah klub, anggota, status turnamen, dan juara terbaru', () => {
    const mrs = [member('a', 'Ana'), member('b', 'Budi')]
    const tk = turnamen({ id: 'tk1', type: 'knockout', name: 'Final Klub', status: 'finished' })
    const d = drawBracket('tk1', ['pt1', 'pt2'])
    let matches = d.matches
    matches = mainkan(matches, matches[0].id, [
      { a: 11, b: 5 },
      { a: 11, b: 5 },
    ])
    const pt: Participant[] = [
      { id: 'pt1', tournament_id: 'tk1', label: 'Ana', member_ids: ['a'] },
      { id: 'pt2', tournament_id: 'tk1', label: 'Budi', member_ids: ['b'] },
    ]
    const r = ringkasDashboard([{ id: 'c1' }], mrs, [tk], pt, matches, [])
    expect(r.jumlahKlub).toBe(1)
    expect(r.jumlahAnggota).toBe(2)
    expect(r.turnamenSelesai).toBe(1)
    expect(r.turnamenAktif).toBe(0)
    expect(r.juaraTerbaru?.nama).toBe(matches[0].participant_a === 'pt1' ? 'Ana' : 'Budi')
    expect(r.topPemain[0].gelar).toBe(1)
  })
})
