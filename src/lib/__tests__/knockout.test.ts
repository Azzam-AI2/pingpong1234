import { describe, expect, it } from 'vitest'
import {
  bracketSize,
  labelBabakBagan,
  drawBracket,
  gamesToWin,
  pemenangTurnamen,
  recompute,
  resolveWinner,
  totalRounds,
  validateGames,
} from '../knockout'
import type { Game, KnockoutMatch } from '../types'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`)

function setResult(matches: KnockoutMatch[], id: string, games: Game[]): KnockoutMatch[] {
  return recompute(matches.map((m) => (m.id === id ? { ...m, games } : m)))
}

describe('ukuran bracket & bye otomatis', () => {
  it('membulatkan jumlah peserta ke pangkat dua terdekat', () => {
    expect(bracketSize(2)).toBe(2)
    expect(bracketSize(3)).toBe(4)
    expect(bracketSize(5)).toBe(8)
    expect(bracketSize(8)).toBe(8)
    expect(bracketSize(9)).toBe(16)
    expect(totalRounds(5)).toBe(3)
    expect(gamesToWin(3)).toBe(2)
    expect(gamesToWin(5)).toBe(3)
  })

  it('5 peserta -> 8 slot, 3 bye, dan bye langsung lolos ke ronde 2', () => {
    const d = drawBracket('t1', ids(5))
    expect(d.size).toBe(8)
    expect(d.rounds).toBe(3)
    expect(d.byeCount).toBe(3)
    expect(d.matches).toHaveLength(4 + 2 + 1)

    const r1 = d.matches.filter((m) => m.round === 1)
    // tepat 3 match hanya berisi satu pemain
    const bye = r1.filter((m) => !!m.participant_a !== !!m.participant_b)
    expect(bye).toHaveLength(3)
    for (const m of bye) expect(m.winner_id).not.toBeNull()

    const r2 = d.matches.filter((m) => m.round === 2)
    // 3 bye sudah naik ke ronde 2, 1 slot masih menunggu pemenang match nyata
    const terisi = r2.flatMap((m) => [m.participant_a, m.participant_b]).filter(Boolean)
    expect(terisi).toHaveLength(3)
  })

  it('menyebar bye ke match berbeda dan tidak ada peserta ganda', () => {
    const d = drawBracket('t1', ids(13))
    const r1 = d.matches.filter((m) => m.round === 1)
    const semua = r1.flatMap((m) => [m.participant_a, m.participant_b]).filter(Boolean)
    expect(new Set(semua).size).toBe(13)
  })
})

describe('turnamen knockout end-to-end', () => {
  it('pemenang otomatis maju sampai juara keluar', () => {
    const d = drawBracket('t2', ids(4))
    let matches = d.matches
    const semi = matches.filter((m) => m.round === 1)

    matches = setResult(matches, semi[0].id, [
      { a: 11, b: 5 },
      { a: 11, b: 7 },
    ])
    matches = setResult(matches, semi[1].id, [
      { a: 9, b: 11 },
      { a: 11, b: 4 },
      { a: 11, b: 9 },
    ])

    const final = matches.find((m) => m.round === 2)!
    expect(final.participant_a).toBe(resolveWinner(matches.find((m) => m.id === semi[0].id)!, 3))
    expect(final.participant_b).toBe(resolveWinner(matches.find((m) => m.id === semi[1].id)!, 3))

    matches = setResult(matches, final.id, [
      { a: 11, b: 13 },
      { a: 11, b: 6 },
      { a: 11, b: 8 },
    ])
    const juara = pemenangTurnamen(matches, 3)
    expect(juara).toBe(final.participant_a)
  })

  it('mengubah hasil match membatalkan hasil match lanjutan yang terpengaruh', () => {
    const d = drawBracket('t3', ids(4))
    let matches = d.matches
    const semi = matches.filter((m) => m.round === 1)
    matches = setResult(matches, semi[0].id, [
      { a: 11, b: 5 },
      { a: 11, b: 5 },
    ])
    matches = setResult(matches, semi[1].id, [
      { a: 11, b: 5 },
      { a: 11, b: 5 },
    ])
    const final = matches.find((m) => m.round === 2)!
    matches = setResult(matches, final.id, [
      { a: 11, b: 5 },
      { a: 11, b: 5 },
    ])
    expect(pemenangTurnamen(matches, 3)).toBe(final.participant_a)

    // semi pertama diubah: pemenangnya jadi pihak B
    matches = setResult(matches, semi[0].id, [
      { a: 5, b: 11 },
      { a: 5, b: 11 },
    ])
    const finalSetelah = matches.find((m) => m.round === 2)!
    expect(finalSetelah.participant_a).toBe(semi[0].participant_b)
    expect(finalSetelah.games).toHaveLength(0)
    expect(finalSetelah.winner_id).toBeNull()
    expect(pemenangTurnamen(matches, 3)).toBeNull()
  })

  it('6 peserta: final tetap kosong sampai semifinal dimainkan (regresi)', () => {
    const d = drawBracket('t6', ids(6))
    expect(d.byeCount).toBe(2)
    const r1 = d.matches.filter((m) => m.round === 1)
    expect(r1.filter((m) => !!m.participant_a !== !!m.participant_b)).toHaveLength(2)

    // babak 2: hanya slot yang berasal dari match bye yang terisi
    const r2 = d.matches.filter((m) => m.round === 2)
    expect(r2.flatMap((m) => [m.participant_a, m.participant_b]).filter(Boolean)).toHaveLength(2)
    expect(r2.every((m) => m.winner_id === null)).toBe(true)

    // final harus kosong, bukan diisi peserta bye
    const final = d.matches.filter((m) => m.round === 3)[0]
    expect(final.participant_a).toBeNull()
    expect(final.participant_b).toBeNull()
    expect(final.winner_id).toBeNull()
    expect(pemenangTurnamen(d.matches, 3)).toBeNull()
  })

  it('pemenang bye tidak dianggap juara tanpa bertanding', () => {
    const d = drawBracket('t7', ids(6))
    let matches = d.matches
    // mainkan babak 1 dan 2 (yang sudah punya dua peserta)
    for (const r of [1, 2]) {
      for (const m of matches.filter((x) => x.round === r && x.participant_a && x.participant_b)) {
        matches = setResult(matches, m.id, [
          { a: 11, b: 4 },
          { a: 11, b: 6 },
        ])
      }
    }
    expect(pemenangTurnamen(matches, 3)).toBeNull()
    // setelah final dimainkan baru ada juara
    const final = matches.filter((m) => m.round === 3)[0]
    expect(final.participant_a).toBeTruthy()
    expect(final.participant_b).toBeTruthy()
    matches = setResult(matches, final.id, [
      { a: 11, b: 9 },
      { a: 11, b: 9 },
    ])
    expect(pemenangTurnamen(matches, 3)).toBe(final.participant_a)
  })

  it('bye berantai pada 3 peserta: final tetap dimainkan lalu juara keluar', () => {
    const d = drawBracket('t4', ids(3))
    let matches = d.matches
    const r1 = matches.filter((m) => m.round === 1)
    const nyata = r1.find((m) => m.participant_a && m.participant_b)!
    matches = setResult(matches, nyata.id, [
      { a: 11, b: 3 },
      { a: 11, b: 3 },
    ])
    const final = matches.find((m) => m.round === 2)!
    expect(final.participant_a).toBeTruthy()
    expect(final.participant_b).toBeTruthy()
    expect(pemenangTurnamen(matches, 3)).toBeNull()

    matches = setResult(matches, final.id, [
      { a: 11, b: 9 },
      { a: 8, b: 11 },
      { a: 11, b: 7 },
    ])
    expect(pemenangTurnamen(matches, 3)).toBe(final.participant_a)
  })
})

describe('validasi skor', () => {
  it('menerima skor sah best of 3', () => {
    expect(validateGames([{ a: 11, b: 5 }, { a: 11, b: 9 }], 3).ok).toBe(true)
    expect(
      validateGames([{ a: 11, b: 9 }, { a: 8, b: 11 }, { a: 11, b: 0 }], 3).ok,
    ).toBe(true)
  })

  it('mewajibkan setiap game sampai 11 poin, tanpa deuce', () => {
    // pemenang game harus tepat 11 poin
    expect(validateGames([{ a: 12, b: 10 }, { a: 11, b: 9 }], 3).ok).toBe(false)
    expect(validateGames([{ a: 13, b: 11 }, { a: 11, b: 9 }], 3).ok).toBe(false)
    expect(validateGames([{ a: 9, b: 7 }], 3).ok).toBe(false)
    // 11-10 tetap sah (batas 11 poin per game)
    expect(validateGames([{ a: 11, b: 10 }, { a: 11, b: 10 }], 3).ok).toBe(true)
    expect(validateGames([{ a: 5, b: 11 }, { a: 11, b: 4 }, { a: 11, b: 6 }], 3).ok).toBe(true)
  })

  it('menolak seri, negatif, dan game berlebih', () => {
    expect(validateGames([{ a: 11, b: 11 }], 3).ok).toBe(false)
    expect(validateGames([{ a: -1, b: 5 }], 3).ok).toBe(false)
    expect(
      validateGames([{ a: 11, b: 5 }, { a: 11, b: 5 }, { a: 11, b: 5 }], 3).ok,
    ).toBe(false)
    expect(validateGames([{ a: 11, b: 5 }], 3).ok).toBe(false)
    // bo3 tapi 4 game (pemenang sudah ditentukan di game 3)
    expect(
      validateGames([{ a: 11, b: 5 }, { a: 5, b: 11 }, { a: 11, b: 5 }, { a: 5, b: 11 }], 3).ok,
    ).toBe(false)
    // bo5 tapi game ke-4 dimainkan setelah 3 kemenangan
    expect(
      validateGames([{ a: 11, b: 5 }, { a: 11, b: 5 }, { a: 11, b: 5 }, { a: 5, b: 11 }], 5).ok,
    ).toBe(false)
  })

  it('butuh 3 game kemenangan pada best of 5', () => {
    expect(
      validateGames([{ a: 11, b: 5 }, { a: 11, b: 5 }], 5).ok,
    ).toBe(false)
    expect(
      validateGames(
        [{ a: 11, b: 5 }, { a: 11, b: 5 }, { a: 11, b: 5 }],
        5,
      ).ok,
    ).toBe(true)
  })
})

describe('resolveWinner', () => {
  it('memakai skor game, bukan urutan pendaftaran', () => {
    const m: KnockoutMatch = {
      id: 'x',
      tournament_id: 't',
      round: 1,
      position: 0,
      participant_a: 'a',
      participant_b: 'b',
      games: [
        { a: 5, b: 11 },
        { a: 5, b: 11 },
      ],
      winner_id: null,
      next_match_id: null,
      next_slot: null,
    }
    expect(resolveWinner(m, 3)).toBe('b')
  })
})

describe('nama babak pada bagan', () => {
  it('menamai babak sesuai jumlah peserta yang tersisa', () => {
    expect(labelBabakBagan(4, 4)).toBe('Final')
    expect(labelBabakBagan(3, 4)).toBe('Semifinal')
    expect(labelBabakBagan(2, 4)).toBe('Perempat Final')
    expect(labelBabakBagan(1, 4)).toBe('Babak 16 Besar')
    expect(labelBabakBagan(1, 5)).toBe('Babak 32 Besar')
    expect(labelBabakBagan(1, 3)).toBe('Perempat Final')
    expect(labelBabakBagan(1, 2)).toBe('Semifinal')
    expect(labelBabakBagan(1, 1)).toBe('Final')
  })
})
