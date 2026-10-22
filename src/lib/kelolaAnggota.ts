import { klienAuth, type HasilAksi } from './auth'

/**
 * Kelola anggota akun (yang punya login): daftar, ubah peran, ubah status.
 *
 * Aturan sebenarnya ada di database (RPC di sql/024). Fungsi di sini hanya
 * menyiapkan pilihan yang masuk akal untuk UI dan menerjemahkan hasilnya.
 */

export interface AnggotaAkun {
  user_id: string
  email: string
  nama: string | null
  role: string
  status: 'invited' | 'active' | 'suspended' | 'left' | string
  joined_at: string | null
}

export async function anggotaAkun(clubId: string): Promise<AnggotaAkun[]> {
  const klien = klienAuth()
  if (!klien) return []
  const { data, error } = await klien.rpc('anggota_akun', { p_club: clubId })
  if (error) return []
  return (data ?? []) as AnggotaAkun[]
}

export async function ubahPeran(clubId: string, userId: string, role: string): Promise<HasilAksi> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }
  const { data, error } = await klien.rpc('ubah_peran_anggota', {
    p_club: clubId,
    p_user: userId,
    p_role: role,
  })
  if (error) return { ok: false, pesan: error.message }
  const hasil = (data ?? {}) as { ok?: boolean; pesan?: string }
  return { ok: Boolean(hasil.ok), pesan: hasil.pesan }
}

export async function ubahStatus(
  clubId: string,
  userId: string,
  status: 'active' | 'suspended' | 'left',
): Promise<HasilAksi> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }
  const { data, error } = await klien.rpc('ubah_status_anggota', {
    p_club: clubId,
    p_user: userId,
    p_status: status,
  })
  if (error) return { ok: false, pesan: error.message }
  const hasil = (data ?? {}) as { ok?: boolean; pesan?: string }
  return { ok: Boolean(hasil.ok), pesan: hasil.pesan }
}

/** Pilihan peran yang boleh diberikan pengubah, mengikuti aturan database. */
export function opsiPeran(pengubah: string): string[] {
  return ['owner', 'org_owner'].includes(pengubah)
    ? ['owner', 'admin', 'official', 'member']
    : ['official', 'member']
}

/**
 * Rencanakan penautan anggota (roster) ke akun klub berdasarkan email.
 *
 * Hasil:
 *  - `user_id`  : akun ditemukan dan siap ditautkan
 *  - `galat`    : akun sudah tertaut ke anggota lain di klub yang sama
 *  - `perluUndang`: email belum punya akun -> simpan sebagai data, lalu kirim undangan
 */
export function rencanakanTautan(
  akun: AnggotaAkun[],
  roster: { id: string; user_id?: string | null }[],
  email: string,
  idSekarang?: string,
): { user_id?: string; galat?: string; perluUndang?: boolean } {
  const surel = email.trim().toLowerCase()
  if (!surel) return {}

  const cocok = akun.find((a) => a.email.trim().toLowerCase() === surel)
  if (!cocok) return { perluUndang: true }

  const bentrok = roster.find((m) => m.user_id === cocok.user_id && m.id !== idSekarang)
  if (bentrok) {
    return { galat: 'Akun itu sudah tertaut ke anggota lain di klub ini.' }
  }

  return { user_id: cocok.user_id }
}

export function labelStatusAnggota(status: string): string {
  switch (status) {
    case 'active':
      return 'Aktif'
    case 'invited':
      return 'Diundang'
    case 'suspended':
      return 'Ditangguhkan'
    case 'left':
      return 'Keluar'
    default:
      return status
  }
}

/** Boleh mengubah peran/status anggota lain? (dipakai untuk menyembunyikan tombol) */
export function bolehKelolaPeran(peranSaya: string | null | undefined): boolean {
  return ['owner', 'org_owner'].includes(peranSaya ?? '')
}

/**
 * Owner terakhir tidak boleh diturunkan/dinonaktifkan — sembunyikan tombolnya
 * supaya pengguna tidak menabrak aturan server.
 */
export function tombolPeranNonaktif(
  peranTarget: string,
  statusTarget: string,
  jumlahOwnerAktif: number,
): boolean {
  return peranTarget === 'owner' && statusTarget === 'active' && jumlahOwnerAktif <= 1
}
