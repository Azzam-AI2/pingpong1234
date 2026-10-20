import type { Game, KnockoutMatch } from './types'
import { roundLabel, shuffle } from './utils'

/** Jumlah slot bracket: pangkat dua terkecil yang >= jumlah peserta (min 2). */
export function bracketSize(n: number): number {
  let s = 2
  while (s < n) s *= 2
  return s
}

export function totalRounds(n: number): number {
  return Math.log2(bracketSize(n))
}

/** Berapa game yang harus dimenangkan untuk memenangi pertandingan Bo3/Bo5. */
export function gamesToWin(bestOf: number): number {
  return Math.ceil(bestOf / 2)
}

export function gameWins(games: Game[]): { a: number; b: number } {
  let a = 0
  let b = 0
  for (const g of games) {
    if (g.a > g.b) a++
    else if (g.b > g.a) b++
  }
  return { a, b }
}

export function winnerSide(games: Game[], bestOf: number): 'a' | 'b' | null {
  const need = gamesToWin(bestOf)
  const w = gameWins(games)
  if (w.a >= need) return 'a'
  if (w.b >= need) return 'b'
  return null
}

export interface ValidasiGame {
  ok: boolean
  error?: string
}

/** Validasi urutan skor game untuk format best of 3 / 5. */
export function validateGames(games: Game[], bestOf: number): ValidasiGame {
  const need = gamesToWin(bestOf)
  if (!games.length) return { ok: false, error: 'Minimal satu game harus diisi.' }
  if (games.length > bestOf) {
    return { ok: false, error: `Format Best of ${bestOf} maksimal ${bestOf} game.` }
  }
  let a = 0
  let b = 0
  for (let i = 0; i < games.length; i++) {
    const g = games[i]
    if (!Number.isInteger(g.a) || !Number.isInteger(g.b)) {
      return { ok: false, error: `Skor game ${i + 1} harus bilangan bulat.` }
    }
    if (g.a < 0 || g.b < 0) return { ok: false, error: `Skor tidak boleh negatif (game ${i + 1}).` }
    if (g.a > 99 || g.b > 99) return { ok: false, error: `Skor maksimal 99 (game ${i + 1}).` }
    if (g.a === g.b) return { ok: false, error: `Game ${i + 1} tidak boleh seri.` }
    if (a >= need || b >= need) {
      return { ok: false, error: `Pertandingan sudah selesai di game ${i}; hapus game ${i + 1}.` }
    }
    if (g.a > g.b) a++
    else b++
  }
  if (a < need && b < need) {
    return {
      ok: false,
      error: `Belum ada pemenang. Format Best of ${bestOf} butuh ${need} game kemenangan.`,
    }
  }
  return { ok: true }
}

export interface DrawResult {
  matches: KnockoutMatch[]
  size: number
  rounds: number
  byeCount: number
}

const matchId = (tournamentId: string, round: number, position: number) =>
  `${tournamentId}-r${round}-p${position}`

/** Undi bracket acak + bye otomatis untuk jumlah peserta non-pangkat dua. */
export function drawBracket(
  tournamentId: string,
  participantIds: string[],
  rand: () => number = Math.random,
): DrawResult {
  const n = participantIds.length
  const size = bracketSize(n)
  const rounds = Math.log2(size)
  const urutan = shuffle(participantIds.slice(), rand)

  const matches: KnockoutMatch[] = []
  for (let r = 1; r <= rounds; r++) {
    const jumlah = size / Math.pow(2, r)
    for (let p = 0; p < jumlah; p++) {
      const nextP = Math.floor(p / 2)
      matches.push({
        id: matchId(tournamentId, r, p),
        tournament_id: tournamentId,
        round: r,
        position: p,
        participant_a: null,
        participant_b: null,
        games: [],
        winner_id: null,
        next_match_id: r < rounds ? matchId(tournamentId, r + 1, nextP) : null,
        next_slot: r < rounds ? (p % 2 === 0 ? 'a' : 'b') : null,
      })
    }
  }

  const babak1 = matches.filter((m) => m.round === 1).sort((x, y) => x.position - y.position)
  const byeCount = size - n
  const slotBye = new Set(
    shuffle(
      babak1.map((m) => m.position),
      rand,
    ).slice(0, byeCount),
  )

  let i = 0
  for (const m of babak1) {
    if (slotBye.has(m.position)) {
      if (rand() < 0.5) m.participant_a = urutan[i++]
      else m.participant_b = urutan[i++]
    } else {
      m.participant_a = urutan[i++]
      m.participant_b = urutan[i++]
    }
  }

  return { matches: recompute(matches), size, rounds, byeCount }
}

/**
 * Hitung ulang seluruh bracket dari data yang tersimpan:
 * - peserta ronde lanjutan diambil dari pemenang ronde sebelumnya
 * - bye (peserta tunggal) otomatis lolos ke ronde berikutnya
 * - pemenang dihitung dari skor game
 * - kalau peserta sebuah match berubah (mis. skor lama diedit), hasil lamanya dibatalkan
 */
export function recompute(matches: KnockoutMatch[]): KnockoutMatch[] {
  const map = new Map<string, KnockoutMatch>()
  for (const m of matches) map.set(m.id, { ...m, games: m.games.map((g) => ({ ...g })) })

  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)

  for (const r of rounds) {
    const babakIni = [...map.values()]
      .filter((m) => m.round === r)
      .sort((a, b) => a.position - b.position)

    for (const m of babakIni) {
      if (r > 1) {
        const sumber = [...map.values()].filter((s) => s.next_match_id === m.id)
        for (const s of sumber) {
          const slot: 'a' | 'b' = s.next_slot === 'b' ? 'b' : 'a'
          const cur = slot === 'a' ? m.participant_a : m.participant_b
          const val = s.winner_id
          if (cur !== val) {
            if (slot === 'a') m.participant_a = val
            else m.participant_b = val
            m.games = []
            m.winner_id = null
          }
        }
      }

      if (!m.games.length) {
        const a = m.participant_a
        const b = m.participant_b
        if (m.round === 1) {
          // bye hanya ada di babak pertama: peserta tunggal langsung lolos
          m.winner_id = a && !b ? a : b && !a ? b : null
        } else {
          // babak lanjutan: slot kosong = pemenang babak sebelumnya belum ada,
          // jadi belum bisa dianggap lolos otomatis
          m.winner_id = null
        }
      } else {
        // pemenang dari mayoritas game (data selalu lewat validasi best of 3/5)
        const w = gameWins(m.games)
        m.winner_id = w.a > w.b ? m.participant_a : w.b > w.a ? m.participant_b : null
      }
    }
  }

  return [...map.values()].sort((a, b) => a.round - b.round || a.position - b.position)
}

/** Pemenang satu match dari skor game yang tersimpan. */
export function resolveWinner(m: KnockoutMatch, bestOf: number): string | null {
  if (!m.games.length) {
    if (m.round > 1) return null
    const a = m.participant_a
    const b = m.participant_b
    return a && !b ? a : b && !a ? b : null
  }
  const side = winnerSide(m.games, bestOf)
  if (side === 'a') return m.participant_a
  if (side === 'b') return m.participant_b
  return null
}

export function pemenangTurnamen(matches: KnockoutMatch[], bestOf: number): string | null {
  if (!matches.length) return null
  const finalRound = Math.max(...matches.map((m) => m.round))
  const final = matches.filter((m) => m.round === finalRound)
  if (final.length !== 1) return null
  return resolveWinner(final[0], bestOf)
}

export function babakTersedia(matches: KnockoutMatch[]): number[] {
  return [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
}

/** Label babak memakai jumlah ronde total bracket. */
export function labelBabak(matches: KnockoutMatch[], round: number): string {
  const total = matches.length ? Math.max(...matches.map((m) => m.round)) : 1
  return roundLabel(round, total)
}

export function matchSudahDimainkan(m: KnockoutMatch): boolean {
  return m.games.length > 0
}

export function ringkasSkor(games: Game[]): string {
  return games.map((g) => `${g.a}-${g.b}`).join(', ')
}

export function jumlahGameMenang(games: Game[]): { a: number; b: number } {
  return gameWins(games)
}
