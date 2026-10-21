import { describe, expect, it } from 'vitest'
import { validateGames } from '../knockout'
import { validasiSkorLiga } from '../liga'
import { generateSchedule, validasiSkorAmericano } from '../americano'
import { profilOlahraga, pemenangPertandingan, aturanDariSettings, validasiGame } from '../sports'

/**
 * Regresi lintas cabang: memastikan jalur pertandingan (knockout & liga) memakai
 * aturan cabang klub, dan perilaku tenis meja tidak berubah.
 */

const aturanBadminton = profilOlahraga('badminton').aturan('knockout')
const aturanPingpong = profilOlahraga('table_tennis').aturan('knockout')

describe('knockout memakai aturan cabang', () => {
  it('bulu tangkis: 21-19 & 21-18 sah, 21-20 ditolak (butuh unggul 2)', () => {
    expect(validateGames([{ a: 21, b: 19 }, { a: 21, b: 18 }], 3, aturanBadminton).ok).toBe(true)
    const kurang = validateGames([{ a: 21, b: 20 }], 3, aturanBadminton)
    expect(kurang.ok).toBe(false)
    expect(kurang.error).toContain('unggul 2')
  })

  it('bulu tangkis: 30-29 sah sebagai batas akhir', () => {
    expect(validateGames([{ a: 30, b: 29 }, { a: 21, b: 15 }], 3, aturanBadminton).ok).toBe(true)
  })

  it('bulu tangkis: skor di atas 30 ditolak', () => {
    const cek = validateGames([{ a: 31, b: 29 }, { a: 21, b: 15 }], 3, aturanBadminton)
    expect(cek.ok).toBe(false)
    expect(cek.error).toContain('maksimal 30')
  })

  it('tenis meja tetap: 11-9 sah, 12-10 ditolak', () => {
    expect(validateGames([{ a: 11, b: 9 }, { a: 11, b: 7 }], 3, aturanPingpong).ok).toBe(true)
    const cek = validateGames([{ a: 12, b: 10 }], 3, aturanPingpong)
    expect(cek.ok).toBe(false)
    expect(cek.error).toContain('tepat 11')
  })

  it('tanpa argumen aturan, perilaku bawaan tetap tenis meja', () => {
    expect(validateGames([{ a: 11, b: 9 }, { a: 11, b: 7 }], 3).ok).toBe(true)
    expect(validateGames([{ a: 21, b: 19 }], 3).ok).toBe(false)
  })
})

describe('padel knockout memakai aturan set', () => {
  const aturanPadel = profilOlahraga('padel').aturan('knockout')

  it('dua set 6-4 dan 6-3 sudah cukup untuk menang', () => {
    const games = [{ a: 6, b: 4 }, { a: 6, b: 3 }]
    expect(validateGames(games, 3, aturanPadel).ok).toBe(true)
    expect(pemenangPertandingan(aturanPadel, games, 3)).toBe('a')
  })

  it('pesan galat menyebut "Set", bukan "Game"', () => {
    const cek = validateGames([{ a: 6, b: 5 }], 3, aturanPadel)
    expect(cek.ok).toBe(false)
    expect(cek.error).toContain('Set 1')
    expect(cek.error).not.toContain('Game 1')
  })

  it('7-6 (tiebreak) dan 7-5 sah, 8-6 ditolak', () => {
    expect(validateGames([{ a: 7, b: 6 }, { a: 6, b: 4 }], 3, aturanPadel).ok).toBe(true)
    expect(validateGames([{ a: 7, b: 5 }, { a: 6, b: 4 }], 3, aturanPadel).ok).toBe(true)
    const cek = validateGames([{ a: 8, b: 6 }, { a: 6, b: 4 }], 3, aturanPadel)
    expect(cek.ok).toBe(false)
    expect(cek.error).toContain('maksimal 7')
  })

  it('kalah dua set: pemenang sisi b, bukan a', () => {
    const games = [{ a: 4, b: 6 }, { a: 3, b: 6 }]
    expect(validateGames(games, 3, aturanPadel).ok).toBe(true)
    expect(pemenangPertandingan(aturanPadel, games, 3)).toBe('b')
  })
})

describe('americano: target poin mengikuti konfigurasi kompetisi', () => {
  it('menerima skor sampai target dan menolak di atasnya', () => {
    expect(validasiSkorAmericano(15, 12, 15)).toBeNull()
    expect(validasiSkorAmericano(15, 15, 15)).toBeNull()
    expect(validasiSkorAmericano(16, 12, 15)).toContain('maksimal 15')
    expect(validasiSkorAmericano(21, 18, 21)).toBeNull()
  })

  it('menolak skor negatif dan bukan bilangan bulat', () => {
    expect(validasiSkorAmericano(-1, 5, 15)).toContain('negatif')
    expect(validasiSkorAmericano(10.5, 5, 15)).toContain('bilangan bulat')
  })
})

describe('americano padel: rotasi pasangan', () => {
  it('8 pemain, 2 ronde: tiap meja 2v2 dan tidak ada pemain dobel dalam satu ronde', () => {
    const pemain = Array.from({ length: 8 }, (_, i) => `p${i}`)
    const plans = generateSchedule(pemain, 2)
    expect(plans.length).toBe(2)

    for (const ronde of plans) {
      const semua = ronde.tables.flatMap((meja) => [...meja.teamA, ...meja.teamB])
      expect(semua.length).toBe(semua.length)
      expect(new Set(semua).size).toBe(semua.length) // tidak ada pemain dobel
      expect(semua.length).toBe(8) // semua pemain bermain
      for (const meja of ronde.tables) {
        expect(meja.teamA.length).toBe(2)
        expect(meja.teamB.length).toBe(2)
      }
      expect(ronde.resting.length).toBe(0)
    }
  })

  it('5 pemain: satu orang istirahat tiap ronde, tidak ada pemain dobel', () => {
    const pemain = Array.from({ length: 5 }, (_, i) => `p${i}`)
    for (const ronde of generateSchedule(pemain, 3)) {
      const semua = ronde.tables.flatMap((meja) => [...meja.teamA, ...meja.teamB])
      expect(new Set(semua).size).toBe(semua.length)
      expect(semua.length + ronde.resting.length).toBe(5)
    }
  })
})

describe('konfigurasi aturan per kompetisi (settings)', () => {
  it('default cabang dipakai kalau settings kosong', () => {
    expect(aturanDariSettings('padel', 'knockout', null)).toMatchObject({
      jenis: 'set',
      tiebreak: true,
      goldenPoint: false,
    })
    expect(aturanDariSettings('padel', 'americano', null)).toMatchObject({ jenis: 'americano', target: 16 })
    expect(aturanDariSettings('table_tennis', 'knockout', null)).toMatchObject({ jenis: 'poin', target: 11 })
  })

  it('settings menimpa default (tiebreak & golden point)', () => {
    const ubah = aturanDariSettings('padel', 'knockout', { tiebreak: false, goldenPoint: true })
    expect(ubah).toMatchObject({ tiebreak: false, goldenPoint: true })
    expect(validasiGame(ubah, 7, 6)).toContain('tiebreak')
  })

  it('target americano mengikuti settings', () => {
    expect(aturanDariSettings('padel', 'americano', { target: 15 })).toMatchObject({ target: 15 })
    expect(aturanDariSettings('badminton', 'liga', { target: 21 })).toMatchObject({ target: 21 })
  })

  it('kunci yang tidak relevan diabaikan (klub pingpong aman)', () => {
    expect(aturanDariSettings('table_tennis', 'knockout', { tiebreak: false, goldenPoint: true })).toMatchObject({
      jenis: 'poin',
      target: 11,
      selisihMin: 1,
    })
  })
})

describe('liga memakai aturan cabang', () => {
  const aturanLigaBadminton = profilOlahraga('badminton').aturan('liga')

  it('bulu tangkis: 21-19 sah, 21-20 ditolak, 19-21 sah', () => {
    expect(validasiSkorLiga(21, 19, 21, aturanLigaBadminton).ok).toBe(true)
    expect(validasiSkorLiga(19, 21, 21, aturanLigaBadminton).ok).toBe(true)
    expect(validasiSkorLiga(21, 20, 21, aturanLigaBadminton).ok).toBe(false)
  })

  it('tenis meja tanpa aturan: perilaku lama (11 poin) dipertahankan', () => {
    expect(validasiSkorLiga(11, 9, 11).ok).toBe(true)
    expect(validasiSkorLiga(12, 10, 11).ok).toBe(false)
    expect(validasiSkorLiga(21, 19, 21).ok).toBe(false)
  })
})
