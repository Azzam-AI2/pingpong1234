import { describe, expect, it } from 'vitest'
import { formatTanggal, formatTanggalPanjang, hurufAwal, todayISO } from '../utils'

const BULAN_PENDEK = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]
const BULAN_PANJANG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

describe('format tanggal', () => {
  it('menampilkan bulan yang benar untuk 12 bulan (tidak ada bulan yang bergeser)', () => {
    for (let m = 1; m <= 12; m++) {
      const iso = `2026-${String(m).padStart(2, '0')}-05`
      expect(formatTanggal(iso)).toBe(`5 ${BULAN_PENDEK[m - 1]} 2026`)
      expect(formatTanggalPanjang(iso)).toBe(`5 ${BULAN_PANJANG[m - 1]} 2026`)
    }
  })

  it('menerima nilai null/kosong dengan aman', () => {
    expect(formatTanggal(null)).toBe('-')
    expect(formatTanggalPanjang(undefined)).toBe('-')
    expect(formatTanggal('')).toBe('-')
  })

  it('todayISO memakai format YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('hurufAwal', () => {
  it('mengambil huruf pertama nama dan mengabaikan spasi di depan', () => {
    expect(hurufAwal('azzam')).toBe('A')
    expect(hurufAwal('  budi santoso')).toBe('B')
    expect(hurufAwal('Éka')).toBe('É')
  })

  it('mengembalikan tanda tanya untuk nama kosong', () => {
    expect(hurufAwal('   ')).toBe('?')
    expect(hurufAwal('')).toBe('?')
  })
})
