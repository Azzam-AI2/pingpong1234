import { klienAuth, pesanGalatAuth, type HasilAksi } from './auth'

/**
 * Pendaftaran mandiri + antrean penugasan klub.
 *
 * Mendaftar TIDAK memberi akses ke klub mana pun. Akun baru masuk antrean
 * `pendaftar` (status 'menunggu') dan baru bisa melihat data klub setelah
 * owner/admin menugaskan klub + peran lewat RPC tugaskan_pendaftar().
 */

export interface HasilDaftar extends HasilAksi {
  butuhKonfirmasiEmail?: boolean
  email?: string
}

export async function daftarAkun(
  email: string,
  sandi: string,
  nama: string,
): Promise<HasilDaftar> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }

  const surel = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(surel)) return { ok: false, pesan: 'Format email tidak valid.' }
  if (sandi.length < 6) return { ok: false, pesan: 'Sandi minimal 6 karakter.' }

  const { data, error } = await klien.auth.signUp({
    email: surel,
    password: sandi,
    options: {
      data: { display_name: nama.trim() || surel.split('@')[0] },
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  })

  if (error) return { ok: false, pesan: pesanGalatAuth(error.message) }

  // Tanpa sesi = email konfirmasi diminta dulu.
  const butuhKonfirmasi = !data.session

  // Catat di antrean. Kalau belum ada sesi (email belum dikonfirmasi), RLS
  // menolak insert — baris antrean akan dibuat saat pengguna pertama masuk
  // lewat fungsi pastikanAntrean() di bawah.
  if (data.session && data.user) {
    await klien.from('pendaftar').insert({
      user_id: data.user.id,
      email: surel,
      nama: nama.trim() || surel.split('@')[0],
    })
  }

  return {
    ok: true,
    email: surel,
    butuhKonfirmasiEmail: butuhKonfirmasi,
    pesan: butuhKonfirmasi
      ? `Akun dibuat. Cek ${surel} untuk tautan konfirmasi, lalu masuk.`
      : 'Akun dibuat. Menunggu pemilik klub menugaskanmu.',
  }
}

/** Pastikan akun yang sudah login punya baris antrean (idempoten). */
export async function pastikanAntrean(): Promise<void> {
  const klien = klienAuth()
  if (!klien) return
  const { data } = await klien.auth.getUser()
  const user = data.user
  if (!user?.email) return
  await klien.from('pendaftar').insert({
    user_id: user.id,
    email: user.email.toLowerCase(),
    nama: (user.user_metadata?.display_name as string | undefined) ?? user.email.split('@')[0],
  })
}

export interface Pendaftar {
  id: string
  user_id: string
  email: string
  nama: string | null
  created_at: string
}

export async function daftarMenunggu(): Promise<Pendaftar[]> {
  const klien = klienAuth()
  if (!klien) return []
  const { data, error } = await klien.rpc('daftar_menunggu')
  if (error) return []
  return (data ?? []) as Pendaftar[]
}

export async function tugaskanPendaftar(
  id: string,
  clubId: string,
  role: string,
): Promise<HasilAksi> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }
  const { data, error } = await klien.rpc('tugaskan_pendaftar', { p_id: id, p_club: clubId, p_role: role })
  if (error) return { ok: false, pesan: error.message }
  const hasil = (data ?? {}) as { ok?: boolean; pesan?: string }
  return { ok: Boolean(hasil.ok), pesan: hasil.pesan }
}

export async function tolakPendaftar(id: string): Promise<HasilAksi> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }
  const { data, error } = await klien.rpc('tolak_pendaftar', { p_id: id })
  if (error) return { ok: false, pesan: error.message }
  const hasil = (data ?? {}) as { ok?: boolean; pesan?: string }
  return { ok: Boolean(hasil.ok), pesan: hasil.pesan }
}
