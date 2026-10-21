import { describe, expect, it } from 'vitest'
import { anggotaAktif, saringAnggota, type KriteriaAnggota } from '../anggota'
import type { Member } from '../types'

const buat = (name: string, gender: 'L' | 'P', aktif?: boolean, created_at = '2026-10-01'): Member => ({
  id: name.toLowerCase(),
  club_id: 'c1',
  name,
  photo_url: null,
  gender,
  aktif: aktif ?? true,
  created_at,
})

const DAFTAR: Member[] = [
  buat('Budi', 'L', true, '2026-10-02'),
  buat('Ana', 'P', true, '2026-10-03'),
  buat('Cici', 'P', false, '2026-10-01'),
  buat('Dedi', 'L', true, '2026-10-04'),
]

const dasar: KriteriaAnggota = { cari: '', gender: 'semua', status: 'semua', urut: 'nama-az' }

describe('saringAnggota', () => {
  it('mengurutkan nama A-Z dan Z-A dengan locale Indonesia', () => {
    expect(saringAnggota(DAFTAR, dasar).map((m) => m.name)).toEqual(['Ana', 'Budi', 'Cici', 'Dedi'])
    expect(saringAnggota(DAFTAR, { ...dasar, urut: 'nama-za' }).map((m) => m.name)).toEqual([
      'Dedi',
      'Cici',
      'Budi',
      'Ana',
    ])
  })

  it('mencari nama tanpa peduli huruf besar/kecil dan sebagian kata', () => {
    expect(saringAnggota(DAFTAR, { ...dasar, cari: 'an' }).map((m) => m.name)).toEqual(['Ana'])
    expect(saringAnggota(DAFTAR, { ...dasar, cari: '  DEDI ' }).map((m) => m.name)).toEqual(['Dedi'])
    expect(saringAnggota(DAFTAR, { ...dasar, cari: 'zzz' })).toHaveLength(0)
  })

  it('menyaring gender', () => {
    expect(saringAnggota(DAFTAR, { ...dasar, gender: 'P' }).map((m) => m.name)).toEqual(['Ana', 'Cici'])
    expect(saringAnggota(DAFTAR, { ...dasar, gender: 'L' }).map((m) => m.name)).toEqual(['Budi', 'Dedi'])
  })

  it('menyaring status aktif/nonaktif, data lama tanpa kolom aktif dianggap aktif', () => {
    const lama = { ...buat('Eka', 'P'), aktif: undefined } as unknown as Member
    const daftar = [...DAFTAR, lama]
    expect(anggotaAktif(lama)).toBe(true)
    expect(saringAnggota(daftar, { ...dasar, status: 'aktif' }).map((m) => m.name)).toEqual([
      'Ana',
      'Budi',
      'Dedi',
      'Eka',
    ])
    expect(saringAnggota(daftar, { ...dasar, status: 'nonaktif' }).map((m) => m.name)).toEqual(['Cici'])
  })

  it('mengurutkan berdasarkan tanggal terdaftar tanpa mengubah daftar asal', () => {
    const asal = DAFTAR.map((m) => m.name)
    expect(saringAnggota(DAFTAR, { ...dasar, urut: 'terbaru' }).map((m) => m.name)).toEqual([
      'Dedi',
      'Ana',
      'Budi',
      'Cici',
    ])
    expect(saringAnggota(DAFTAR, { ...dasar, urut: 'terlama' }).map((m) => m.name)).toEqual([
      'Cici',
      'Budi',
      'Ana',
      'Dedi',
    ])
    expect(DAFTAR.map((m) => m.name)).toEqual(asal)
  })

  it('menggabungkan beberapa kriteria', () => {
    expect(
      saringAnggota(DAFTAR, { cari: 'a', gender: 'P', status: 'aktif', urut: 'nama-az' }).map(
        (m) => m.name,
      ),
    ).toEqual(['Ana'])
  })
})
