import { klienAuth, type HasilAksi } from './auth'

/** Hasil penambahan akun ke klub lewat email. */
export interface HasilTambahAkun extends HasilAksi {
  perluUndang?: boolean
  userId?: string
}

/**
 * Tambahkan akun yang SUDAH ADA ke klub dengan peran tertentu.
 * Kalau email belum punya akun, server membalas perlu_undang = true —
 * pemanggil yang mengirim undangan lewat Edge Function.
 */
export async function tambahAkunKeKlub(
  clubId: string,
  email: string,
  role: string,
): Promise<HasilTambahAkun> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }

  const surel = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(surel)) {
    return { ok: false, pesan: 'Format email tidak valid.' }
  }

  const { data, error } = await klien.rpc('tambah_anggota_email', {
    p_club: clubId,
    p_email: surel,
    p_role: role,
  })
  if (error) return { ok: false, pesan: error.message }

  const hasil = (data ?? {}) as {
    ok?: boolean
    pesan?: string
    perlu_undang?: boolean
    user_id?: string
  }
  return {
    ok: Boolean(hasil.ok),
    pesan: hasil.pesan,
    perluUndang: Boolean(hasil.perlu_undang),
    userId: hasil.user_id,
  }
}
