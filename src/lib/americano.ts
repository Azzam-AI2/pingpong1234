import type { AmericanoMatch } from './types'
import { shuffle } from './utils'

/**
 * Validasi skor satu pertandingan Americano.
 * Target poin mengikuti konfigurasi kompetisi (tidak lagi dipatok 0-99),
 * sehingga padel (target 15/16/21) dan pingpong memakai aturan yang sama.
 */
export function validasiSkorAmericano(skorA: number, skorB: number, target: number): string | null {
  if (!Number.isInteger(skorA) || !Number.isInteger(skorB)) return 'Skor harus bilangan bulat.'
  if (skorA < 0 || skorB < 0) return 'Skor tidak boleh negatif.'
  if (skorA > target || skorB > target) return `Skor maksimal ${target} poin per pertandingan.`
  return null
}

export interface AmerTable {
  tableNo: number
  teamA: string[]
  teamB: string[]
}

export interface AmerRoundPlan {
  roundNo: number
  tables: AmerTable[]
  resting: string[]
}

/** Saran jumlah ronde agar semua pemain banyak dapat pasangan berbeda. */
export function suggestRounds(n: number): number {
  if (n < 4) return 1
  if (n % 4 === 0) return Math.max(3, n - 1)
  return Math.max(3, n)
}

function kunci(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`
}

function tambah(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/**
 * Jadwal rotasi pasangan Americano.
 * - 4 pemain per meja (2 vs 2). Sisa pemain (n % 4) istirahat dan dibagi bergiliran.
 * - Usaha minimal agar pasangan dan lawan tidak berulang: untuk setiap ronde
 *   beberapa kandidat pembagian dicoba lalu dipilih yang biaya pengulangannya
 *   paling kecil; kalau masih ada pengulangan, seluruh jadwal dicoba ulang
 *   (beberapa kali) dan yang paling bersih dipakai.
 */
export function generateSchedule(
  playerIds: string[],
  rounds: number,
  rand: () => number = Math.random,
): AmerRoundPlan[] {
  let terbaik: AmerRoundPlan[] | null = null
  let skorTerbaik = Number.POSITIVE_INFINITY
  const percobaanPenuh = 30

  for (let t = 0; t < percobaanPenuh; t++) {
    const kandidat = bangunJadwal(playerIds, rounds, rand)
    const skor = hitungPengulangan(kandidat)
    if (skor < skorTerbaik) {
      skorTerbaik = skor
      terbaik = kandidat
    }
    if (skorTerbaik === 0) break
  }

  return terbaik ?? bangunJadwal(playerIds, rounds, rand)
}

/** Jumlah pengulangan pasangan (bobot besar) dan lawan (bobot kecil). */
export function hitungPengulangan(plans: AmerRoundPlan[]): number {
  const partner = new Map<string, number>()
  const lawan = new Map<string, number>()
  for (const r of plans) {
    for (const t of r.tables) {
      tambah(partner, kunci(t.teamA[0], t.teamA[1]))
      tambah(partner, kunci(t.teamB[0], t.teamB[1]))
      for (const x of t.teamA) {
        for (const y of t.teamB) tambah(lawan, kunci(x, y))
      }
    }
  }
  let skor = 0
  for (const c of partner.values()) if (c > 1) skor += (c - 1) * 100
  for (const c of lawan.values()) if (c > 2) skor += c - 2
  return skor
}

function bangunJadwal(
  playerIds: string[],
  rounds: number,
  rand: () => number,
): AmerRoundPlan[] {
  const n = playerIds.length
  const restPerRound = n % 4
  const partnerCount = new Map<string, number>()
  const opponentCount = new Map<string, number>()
  const restCount = new Map<string, number>(playerIds.map((id) => [id, 0]))

  const plans: AmerRoundPlan[] = []

  for (let r = 1; r <= rounds; r++) {
    // pilih pemain yang istirahat: yang paling jarang istirahat dulu
    const restOrder = playerIds
      .slice()
      .sort((a, b) => (restCount.get(a)! - restCount.get(b)!) || (rand() < 0.5 ? -1 : 1))
    const resting = restOrder.slice(0, restPerRound)
    const setRest = new Set(resting)
    const playing = shuffle(
      playerIds.filter((id) => !setRest.has(id)),
      rand,
    )
    for (const id of resting) restCount.set(id, restCount.get(id)! + 1)

    let bestTables: AmerTable[] | null = null
    let bestCost = Number.POSITIVE_INFINITY
    const percobaan = 300

    for (let t = 0; t < percobaan; t++) {
      const arr = t === 0 ? playing.slice() : shuffle(playing, rand)
      const tables: AmerTable[] = []
      let cost = 0
      for (let i = 0; i + 3 < arr.length; i += 4) {
        const p1 = arr[i]
        const p2 = arr[i + 1]
        const p3 = arr[i + 2]
        const p4 = arr[i + 3]
        tables.push({ tableNo: tables.length + 1, teamA: [p1, p2], teamB: [p3, p4] })
        const c1 = partnerCount.get(kunci(p1, p2)) ?? 0
        const c2 = partnerCount.get(kunci(p3, p4)) ?? 0
        cost += 100 * Math.pow(c1, 3) + 100 * Math.pow(c2, 3)
        for (const x of [p1, p2]) {
          for (const y of [p3, p4]) {
            cost += opponentCount.get(kunci(x, y)) ?? 0
          }
        }
      }
      if (cost < bestCost) {
        bestCost = cost
        bestTables = tables
      }
      if (bestCost === 0) break
    }

    const tables = bestTables ?? []
    for (const tb of tables) {
      tambah(partnerCount, kunci(tb.teamA[0], tb.teamA[1]))
      tambah(partnerCount, kunci(tb.teamB[0], tb.teamB[1]))
      for (const x of tb.teamA) {
        for (const y of tb.teamB) {
          tambah(opponentCount, kunci(x, y))
        }
      }
    }

    plans.push({ roundNo: r, tables, resting })
  }

  return plans
}

export interface AmerStanding {
  memberId: string
  matches: number
  wins: number
  losses: number
  points: number
  diff: number
  rank: number
}

/** Klasemen individu Americano: poin = jumlah poin yang dicetak timnya. */
export function americanoStandings(
  playerIds: string[],
  matches: AmericanoMatch[],
): AmerStanding[] {
  const base = new Map<string, AmerStanding>()
  for (const id of playerIds) {
    base.set(id, { memberId: id, matches: 0, wins: 0, losses: 0, points: 0, diff: 0, rank: 0 })
  }

  for (const m of matches) {
    if (m.score_a === null || m.score_b === null) continue
    const menangA = m.score_a > m.score_b
    const selisihA = m.score_a - m.score_b
    for (const id of m.team_a) {
      const s = base.get(id)
      if (!s) continue
      s.matches++
      s.points += m.score_a
      s.diff += selisihA
      if (menangA) s.wins++
      else s.losses++
    }
    for (const id of m.team_b) {
      const s = base.get(id)
      if (!s) continue
      s.matches++
      s.points += m.score_b
      s.diff -= selisihA
      if (!menangA) s.wins++
      else s.losses++
    }
  }

  const arr = [...base.values()].sort(
    (x, y) => y.points - x.points || y.wins - x.wins || y.diff - x.diff || x.memberId.localeCompare(y.memberId),
  )

  let prev: AmerStanding | null = null
  arr.forEach((s, idx) => {
    if (
      prev &&
      prev.points === s.points &&
      prev.wins === s.wins &&
      prev.diff === s.diff
    ) {
      s.rank = prev.rank
    } else {
      s.rank = idx + 1
    }
    prev = s
  })

  return arr
}

export interface PeringkatAmericano {
  memberId: string
  points: number
  rank: number
}

/** Juara Americano (poin tertinggi, seri dihitung bersama). Pemain tanpa match belum juara. */
export function juaraAmericano(standings: AmerStanding[]): PeringkatAmericano[] {
  const ikut = standings.filter((s) => s.matches > 0)
  if (!ikut.length) return []
  const top = ikut[0]
  return ikut
    .filter((s) => s.points === top.points && s.wins === top.wins && s.diff === top.diff)
    .map((s) => ({ memberId: s.memberId, points: s.points, rank: s.rank }))
}
