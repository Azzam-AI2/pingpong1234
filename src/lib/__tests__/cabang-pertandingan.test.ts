import { describe, expect, it } from 'vitest'
import { validateGames } from '../knockout'
import { validasiSkorLiga } from '../liga'
import { profilOlahraga, pemenangPertandingan } from '../sports'

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
