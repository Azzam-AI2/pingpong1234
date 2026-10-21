import type { Gender, Member } from './types'

export type StatusAnggota = 'semua' | 'aktif' | 'nonaktif'
export type UrutAnggota = 'nama-az' | 'nama-za' | 'terbaru' | 'terlama'

export interface KriteriaAnggota {
  cari: string
  gender: 'semua' | Gender
  status: StatusAnggota
  urut: UrutAnggota
}

/** Anggota tanpa nilai `aktif` (data lama) dianggap aktif. */
export function anggotaAktif(m: Pick<Member, 'aktif'>): boolean {
  return m.aktif !== false
}

const PEMBANDING: Record<UrutAnggota, (a: Member, b: Member) => number> = {
  'nama-az': (a, b) => a.name.localeCompare(b.name, 'id'),
  'nama-za': (a, b) => b.name.localeCompare(a.name, 'id'),
  terbaru: (a, b) =>
    a.created_at === b.created_at
      ? a.name.localeCompare(b.name, 'id')
      : a.created_at < b.created_at
        ? 1
        : -1,
  terlama: (a, b) =>
    a.created_at === b.created_at
      ? a.name.localeCompare(b.name, 'id')
      : a.created_at > b.created_at
        ? 1
        : -1,
}

/** Saring (nama/gender/status) lalu urutkan daftar anggota. */
export function saringAnggota<T extends Member>(daftar: T[], k: KriteriaAnggota): T[] {
  const kata = k.cari.trim().toLowerCase()
  const hasil = daftar.filter((m) => {
    if (kata && !m.name.toLowerCase().includes(kata)) return false
    if (k.gender !== 'semua' && m.gender !== k.gender) return false
    if (k.status === 'aktif' && !anggotaAktif(m)) return false
    if (k.status === 'nonaktif' && anggotaAktif(m)) return false
    return true
  })
  return hasil.slice().sort(PEMBANDING[k.urut])
}
