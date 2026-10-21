import { describe, expect, it } from 'vitest'
import {
  ATURAN_BULU_TANGKIS,
  ATURAN_PADEL_AMERICANO,
  ATURAN_PADEL_SET,
  ATURAN_TENIS_MEJA,
  formatDidukung,
  formatTersedia,
  gamesUntukMenang,
  pemenangGame,
  pemenangPertandingan,
  profilOlahraga,
  statusPoinTenis,
  validasiGame,
  validasiPertandingan,
} from '../sports'

describe('tenis meja (perilaku lama tidak berubah)', () => {
  it('menang tepat 11 poin, tanpa deuce', () => {
    expect(pemenangGame(ATURAN_TENIS_MEJA, 11, 9)).toBe('a')
    expect(pemenangGame(ATURAN_TENIS_MEJA, 10, 9)).toBeNull()
    expect(validasiGame(ATURAN_TENIS_MEJA, 11, 9)).toBeNull()
    expect(validasiGame(ATURAN_TENIS_MEJA, 12, 10)).toContain('tepat 11')
    expect(validasiGame(ATURAN_TENIS_MEJA, 11, 11)).toContain('seri')
  })

  it('best of 3 selesai setelah dua game', () => {
    const games = [{ a: 11, b: 9 }, { a: 11, b: 7 }]
    expect(validasiPertandingan(ATURAN_TENIS_MEJA, games, 3).ok).toBe(true)
    expect(pemenangPertandingan(ATURAN_TENIS_MEJA, games, 3)).toBe('a')
  })

  it('best of 3 belum selesai setelah satu game', () => {
    const games = [{ a: 11, b: 9 }]
    expect(validasiPertandingan(ATURAN_TENIS_MEJA, games, 3).ok).toBe(false)
    expect(pemenangPertandingan(ATURAN_TENIS_MEJA, games, 3)).toBeNull()
  })
})

describe('bulu tangkis (21 poin, deuce, batas 30)', () => {
  it('menang 21 dengan selisih minimal 2', () => {
    expect(pemenangGame(ATURAN_BULU_TANGKIS, 21, 19)).toBe('a')
    expect(pemenangGame(ATURAN_BULU_TANGKIS, 21, 20)).toBeNull()
    expect(pemenangGame(ATURAN_BULU_TANGKIS, 22, 20)).toBe('a')
  })

  it('20-20 berlanjut sampai unggul 2, dan 29-29 ditutup di 30', () => {
    expect(validasiGame(ATURAN_BULU_TANGKIS, 21, 20)).toContain('unggul 2')
    expect(validasiGame(ATURAN_BULU_TANGKIS, 25, 23)).toBeNull()
    expect(pemenangGame(ATURAN_BULU_TANGKIS, 30, 29)).toBe('a')
    expect(validasiGame(ATURAN_BULU_TANGKIS, 31, 29)).toContain('maksimal 30')
  })

  it('menolak game yang belum selesai', () => {
    expect(validasiGame(ATURAN_BULU_TANGKIS, 15, 12)).toContain('belum selesai')
  })

  it('best of 3 game dengan deuce', () => {
    const games = [{ a: 21, b: 19 }, { a: 19, b: 21 }, { a: 22, b: 20 }]
    expect(validasiPertandingan(ATURAN_BULU_TANGKIS, games, 3).ok).toBe(true)
    expect(pemenangPertandingan(ATURAN_BULU_TANGKIS, games, 3)).toBe('a')
  })
})

describe('padel — tennis scoring (set)', () => {
  it('set butuh 6 game dengan selisih 2, atau 7-5 / 7-6', () => {
    expect(pemenangGame(ATURAN_PADEL_SET, 6, 4)).toBe('a')
    expect(pemenangGame(ATURAN_PADEL_SET, 6, 5)).toBeNull()
    expect(pemenangGame(ATURAN_PADEL_SET, 7, 5)).toBe('a')
    expect(pemenangGame(ATURAN_PADEL_SET, 7, 6)).toBe('a')
    expect(validasiGame(ATURAN_PADEL_SET, 7, 7)).toContain('7-7')
    expect(validasiGame(ATURAN_PADEL_SET, 6, 3)).toBeNull()
  })

  it('menolak set 7-6 jika tiebreak dimatikan', () => {
    const tanpaTiebreak = { ...ATURAN_PADEL_SET, tiebreak: false }
    expect(validasiGame(tanpaTiebreak, 7, 6)).toContain('tiebreak')
  })

  it('best of 3 set: pemenang setelah dua set', () => {
    const dua = [{ a: 6, b: 4 }, { a: 6, b: 3 }]
    expect(pemenangPertandingan(ATURAN_PADEL_SET, dua, 3)).toBe('a')
    expect(validasiPertandingan(ATURAN_PADEL_SET, dua, 3).ok).toBe(true)
    const tiga = [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 6 }]
    expect(pemenangPertandingan(ATURAN_PADEL_SET, tiga, 3)).toBe('a')
  })
})

describe('padel — americano scoring', () => {
  it('hanya memvalidasi rentang poin, tanpa pemenang game', () => {
    expect(validasiGame(ATURAN_PADEL_AMERICANO, 16, 12)).toBeNull()
    expect(validasiGame(ATURAN_PADEL_AMERICANO, 17, 10)).toContain('maksimal 16')
    expect(pemenangPertandingan(ATURAN_PADEL_AMERICANO, [{ a: 16, b: 12 }], 3)).toBeNull()
  })
})

describe('status poin tenis (deuce, advantage, golden point)', () => {
  it('40-40 adalah deuce, advantage lalu game', () => {
    expect(statusPoinTenis(3, 3)).toMatchObject({ a: '40', b: '40', selesai: false })
    expect(statusPoinTenis(4, 3)).toMatchObject({ a: 'AD', b: '40', selesai: false })
    expect(statusPoinTenis(5, 3).selesai).toBe(true)
    expect(statusPoinTenis(5, 3).pemenang).toBe('a')
  })

  it('golden point: satu poin setelah deuce langsung menang', () => {
    const deuce = statusPoinTenis(3, 3, true)
    expect(deuce.selesai).toBe(false)
    const sesudah = statusPoinTenis(4, 3, true)
    expect(sesudah.selesai).toBe(true)
    expect(sesudah.pemenang).toBe('a')
  })
})

describe('registry cabang olahraga', () => {
  it('format kompetisi mengikuti cabang', () => {
    expect(formatTersedia('padel')).toEqual(['knockout', 'americano'])
    expect(formatTersedia('badminton')).toEqual(['knockout', 'liga'])
    expect(formatTersedia('table_tennis')).toContain('liga')
    expect(formatDidukung('badminton', 'americano')).toBe(false)
    expect(formatDidukung('padel', 'liga')).toBe(false)
  })

  it('slug tidak dikenal jatuh ke tenis meja (klub lama aman)', () => {
    expect(profilOlahraga('entah').slug).toBe('table_tennis')
    expect(profilOlahraga(null).slug).toBe('table_tennis')
  })

  it('aturan default per cabang sesuai permintaan', () => {
    expect(profilOlahraga('badminton').aturan('knockout')).toMatchObject({ target: 21, batasMaks: 30 })
    expect(profilOlahraga('padel').aturan('knockout')).toMatchObject({ jenis: 'set' })
    expect(profilOlahraga('padel').aturan('americano')).toMatchObject({ jenis: 'americano' })
    expect(gamesUntukMenang(3)).toBe(2)
    expect(gamesUntukMenang(5)).toBe(3)
  })
})
