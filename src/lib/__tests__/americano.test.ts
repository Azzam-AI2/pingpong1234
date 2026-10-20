import { describe, expect, it } from 'vitest'
import {
  americanoStandings,
  generateSchedule,
  juaraAmericano,
  suggestRounds,
} from '../americano'
import type { AmericanoMatch } from '../types'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`)

function pasangan(plans: ReturnType<typeof generateSchedule>) {
  const map = new Map<string, number>()
  for (const r of plans) {
    for (const t of r.tables) {
      for (const tim of [t.teamA, t.teamB]) {
        const key = [tim[0], tim[1]].sort().join('|')
        map.set(key, (map.get(key) ?? 0) + 1)
      }
    }
  }
  return map
}

describe('jadwal rotasi Americano', () => {
  it('8 pemain / 7 ronde: semua pemain selalu bertanding dan tidak ada pasangan berulang', () => {
    const plans = generateSchedule(ids(8), suggestRounds(8))
    expect(plans).toHaveLength(7)
    for (const r of plans) {
      expect(r.tables).toHaveLength(2)
      expect(r.resting).toHaveLength(0)
      const pemain = r.tables.flatMap((t) => [...t.teamA, ...t.teamB])
      expect(new Set(pemain).size).toBe(8)
    }
    const p = pasangan(plans)
    expect(p.size).toBe(28) // C(8,2): semua kombinasi pasangan unik
    expect([...p.values()].every((v) => v === 1)).toBe(true)
  })

  it('6 pemain: sisa pemain istirahat bergiliran dan adil', () => {
    const plans = generateSchedule(ids(6), 6)
    const jumlahIstirahat = new Map<string, number>()
    for (const r of plans) {
      expect(r.tables).toHaveLength(1)
      expect(r.resting).toHaveLength(2)
      const main = r.tables.flatMap((t) => [...t.teamA, ...t.teamB])
      expect(main).toHaveLength(4)
      expect(new Set([...main, ...r.resting]).size).toBe(6)
      for (const id of r.resting) jumlahIstirahat.set(id, (jumlahIstirahat.get(id) ?? 0) + 1)
    }
    // 6 ronde x 2 istirahat = 12 slot / 6 pemain = 2 kali masing-masing
    expect([...jumlahIstirahat.values()]).toEqual([2, 2, 2, 2, 2, 2])
  })

  it('5 pemain: satu pemain istirahat per ronde, tidak berulang pasangan', () => {
    const plans = generateSchedule(ids(5), 5)
    const counts = new Map<string, number>()
    for (const r of plans) {
      expect(r.resting).toHaveLength(1)
      expect(r.tables).toHaveLength(1)
      counts.set(r.resting[0], (counts.get(r.resting[0]) ?? 0) + 1)
    }
    expect([...counts.values()]).toEqual([1, 1, 1, 1, 1])
    const p = pasangan(plans)
    expect([...p.values()].every((v) => v === 1)).toBe(true)
  })
})

describe('klasemen individu Americano', () => {
  const matches: AmericanoMatch[] = [
    {
      id: 'm1',
      tournament_id: 't',
      round_id: 'r1',
      round_no: 1,
      table_no: 1,
      team_a: ['a', 'b'],
      team_b: ['c', 'd'],
      score_a: 21,
      score_b: 15,
    },
    {
      id: 'm2',
      tournament_id: 't',
      round_id: 'r1',
      round_no: 1,
      table_no: 1,
      team_a: ['a', 'c'],
      team_b: ['b', 'd'],
      score_a: 10,
      score_b: 21,
    },
  ]

  it('kedua pemain satu tim mendapat poin yang sama dari skor tim', () => {
    const k = americanoStandings(['a', 'b', 'c', 'd'], matches)
    const a = k.find((x) => x.memberId === 'a')!
    const b = k.find((x) => x.memberId === 'b')!
    expect(a.points).toBe(31) // 21 + 10
    expect(b.points).toBe(42) // 21 + 21
    expect(a.matches).toBe(2)
    expect(a.wins).toBe(1)
    expect(a.losses).toBe(1)
    expect(b.wins).toBe(2)
    expect(k[0].memberId).toBe('b')
    expect(k[0].rank).toBe(1)
  })

  it('mengabaikan match yang belum ada skornya', () => {
    const belum: AmericanoMatch[] = [
      { ...matches[0], id: 'm3', score_a: null, score_b: null },
    ]
    const k = americanoStandings(ids(4), belum)
    expect(k.every((x) => x.matches === 0 && x.points === 0)).toBe(true)
    expect(juaraAmericano(k)).toHaveLength(0)
  })

  it('juara seri dihitung bersama', () => {
    // dua pertandingan tim yang sama dengan hasil terbalik -> semua pemain sama kuat
    const seri: AmericanoMatch[] = [
      { ...matches[0], id: 's1', score_a: 21, score_b: 15 },
      { ...matches[0], id: 's2', score_a: 15, score_b: 21 },
    ]
    const k = americanoStandings(['a', 'b', 'c', 'd'], seri)
    expect(k.every((x) => x.points === 36 && x.wins === 1 && x.losses === 1 && x.diff === 0)).toBe(
      true,
    )
    expect(juaraAmericano(k)).toHaveLength(4)
  })
})
