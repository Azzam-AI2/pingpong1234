import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { ambilKlien, bacaKonfigurasiSupabase } from './storage/supabase'

export type { Session }

/**
 * Lapisan autentikasi & keanggotaan.
 *
 * Prinsip:
 *  - Password TIDAK pernah ditangani aplikasi; semuanya lewat Supabase Auth.
 *  - Klien yang dipakai sama dengan klien data, sehingga token sesi otomatis
 *    dikirim ke PostgREST dan policy RLS melihat identitas yang benar.
 *  - Semua keputusan izin tetap di database (has_perm). Fungsi di sini hanya
 *    untuk kenyamanan UI.
 */

/** True kalau Supabase terkonfigurasi (mode online). Mode lokal tidak butuh login. */
export function modeOnline(): boolean {
  return bacaKonfigurasiSupabase().status === 'siap'
}

export function klienAuth(): SupabaseClient | null {
  const cfg = bacaKonfigurasiSupabase()
  if (cfg.status !== 'siap') return null
  return ambilKlien(cfg.url, cfg.anonKey)
}

/** Alamat aplikasi saat ini — dipakai sebagai tujuan kembali tautan email. */
export function alamatAplikasi(): string {
  return `${window.location.origin}${window.location.pathname}`
}

/** Ubah pesan galat Supabase Auth menjadi kalimat Indonesia yang jelas. */
export function pesanGalatAuth(pesan: string): string {
  const p = String(pesan ?? '').toLowerCase()
  if (!p) return 'Terjadi kesalahan. Coba lagi.'
  if (p.includes('invalid login credentials')) return 'Email atau sandi salah.'
  if (p.includes('email not confirmed')) return 'Email belum dikonfirmasi. Buka tautan verifikasi di kotak masuk.'
  if (p.includes('user already registered') || p.includes('already been registered'))
    return 'Email ini sudah punya akun. Minta pemilik klub mengundang lewat email tersebut.'
  if (p.includes('password should be at least')) return 'Sandi terlalu pendek (minimal 6 karakter).'
  if (p.includes('email rate limit') || p.includes('over_email_send_rate_limit')) {
    return (
      'Kuota kirim email Supabase habis (paket gratis hanya ±2–4 email/jam). ' +
      'Pilihan: tunggu ±1 jam, matikan "Confirm email" di Supabase Auth, atau pasang SMTP sendiri. ' +
      'Kalau penerima sudah punya akun, undangan tetap bisa lewat menu Anggota → Undang anggota.'
    )
  }
  if (p.includes('rate limit') || p.includes('too many')) {
    return 'Terlalu banyak percobaan masuk/daftar dari jaringan ini. Tunggu beberapa menit lalu coba lagi.'
  }
  if (p.includes('unable to validate email') || p.includes('invalid email'))
    return 'Format email tidak valid.'
  if (p.includes('session missing') || p.includes('session not found') || p.includes('jwt expired'))
    return 'Sesi sudah berakhir. Silakan masuk ulang.'
  if (p.includes('network') || p.includes('failed to fetch'))
    return 'Tidak bisa menghubungi server. Periksa koneksi internet.'
  return pesan
}

export interface HasilAksi {
  ok: boolean
  pesan?: string
}

export async function masuk(email: string, sandi: string): Promise<HasilAksi> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi (mode lokal tidak butuh login).' }
  const { error } = await klien.auth.signInWithPassword({ email: email.trim(), password: sandi })
  if (error) return { ok: false, pesan: pesanGalatAuth(error.message) }
  return { ok: true }
}

export async function keluar(): Promise<void> {
  await klienAuth()?.auth.signOut()
}

export async function sesiSekarang(): Promise<Session | null> {
  const klien = klienAuth()
  if (!klien) return null
  const { data } = await klien.auth.getSession()
  return data.session ?? null
}

export async function emailSaya(): Promise<string | null> {
  const klien = klienAuth()
  if (!klien) return null
  const { data } = await klien.auth.getUser()
  return data.user?.email ?? null
}

/** Berlangganan perubahan sesi (masuk, keluar, token diperbarui). */
export function pasangPendengarSesi(cb: (sesi: Session | null) => void): () => void {
  const klien = klienAuth()
  if (!klien) return () => {}
  const { data } = klien.auth.onAuthStateChange((_peristiwa, sesi) => cb(sesi))
  return () => data.subscription.unsubscribe()
}

export async function mintaResetSandi(email: string): Promise<HasilAksi> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }
  const { error } = await klien.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: alamatAplikasi(),
  })
  if (error) return { ok: false, pesan: pesanGalatAuth(error.message) }
  return { ok: true }
}

export async function aturSandiBaru(sandi: string): Promise<HasilAksi> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }
  if (sandi.length < 6) return { ok: false, pesan: 'Sandi minimal 6 karakter.' }
  const { error } = await klien.auth.updateUser({ password: sandi })
  if (error) return { ok: false, pesan: pesanGalatAuth(error.message) }
  return { ok: true }
}

/**
 * Tautan undangan/reset dari email membawa token di bagian hash URL.
 * SDK Supabase mengambil token itu saat getSession(); sesudahnya kita
 * mengganti hash menjadi rute "atur sandi" supaya tidak bentrok dengan router.
 */
export async function tanganiTautanAuth(): Promise<boolean> {
  const hash = window.location.hash
  if (!/access_token=|type=invite|type=recovery|error_description=/.test(hash)) return false
  const klien = klienAuth()
  if (klien) {
    try {
      await klien.auth.getSession()
    } catch {
      /* token tidak valid — biarkan layar masuk yang menjelaskan */
    }
  }
  const galat = /error_description=([^&]+)/.exec(hash)?.[1]
  const baruDaftar = /type=signup/.test(hash)
  const tujuan = galat ? '#/masuk' : baruDaftar ? '#/' : '#/atur-sandi'
  window.history.replaceState(null, '', `${window.location.pathname}${tujuan}`)
  // router mendengarkan hashchange; replaceState tidak memicunya
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  return !galat
}

// ------------------------------------------------------------------ undangan

export interface Undangan {
  id: string
  club_id: string
  club_name: string
  role: string
  expires_at: string
  status: string
  invited_by_nama: string | null
}

export async function undanganSaya(): Promise<Undangan[]> {
  const klien = klienAuth()
  if (!klien) return []
  const { data, error } = await klien.rpc('undangan_saya')
  if (error) return []
  return (data ?? []) as Undangan[]
}

export async function terimaUndangan(id: string): Promise<HasilAksi & { club_id?: string }> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }
  const { data, error } = await klien.rpc('terima_undangan', { p_id: id })
  if (error) return { ok: false, pesan: error.message }
  const hasil = (data ?? {}) as { ok?: boolean; pesan?: string; club_id?: string }
  return { ok: Boolean(hasil.ok), pesan: hasil.pesan, club_id: hasil.club_id }
}

export async function tolakUndangan(id: string): Promise<HasilAksi> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }
  const { data, error } = await klien.rpc('tolak_undangan', { p_id: id })
  if (error) return { ok: false, pesan: error.message }
  const hasil = (data ?? {}) as { ok?: boolean; pesan?: string }
  return { ok: Boolean(hasil.ok), pesan: hasil.pesan }
}

export interface KlubSaya {
  club_id: string
  club_name: string
  role: string
  via: string
}

/** Klub yang boleh diakses pengguna (langsung atau lewat organisasi). */
export async function klubSaya(): Promise<KlubSaya[]> {
  const klien = klienAuth()
  if (!klien) return []
  const { data, error } = await klien.rpc('my_clubs')
  if (error) return []
  return (data ?? []) as KlubSaya[]
}

/**
 * Apakah pengguna berhak membuat klub baru (platform admin atau org_owner).
 * Dicek di server; UI hanya mengikuti hasilnya.
 */
export async function bolehBuatKlub(): Promise<boolean> {
  const klien = klienAuth()
  if (!klien) return true // mode lokal: tanpa pembatasan
  const { data, error } = await klien.rpc('boleh_buat_klub')
  if (error) return false
  return data === true
}

// ------------------------------------------------------------------ util kecil

/** Sisa hari sampai undangan kedaluwarsa (0 = sudah lewat). */
export function sisaHari(iso: string): number {
  const waktu = new Date(iso).getTime()
  if (!Number.isFinite(waktu)) return 0
  return Math.max(0, Math.ceil((waktu - Date.now()) / 86_400_000))
}

export function labelPeran(role: string): string {
  switch (role) {
    case 'owner':
      return 'Pemilik klub'
    case 'admin':
      return 'Admin klub'
    case 'official':
      return 'Petugas pertandingan'
    case 'member':
      return 'Anggota'
    case 'org_owner':
      return 'Pemilik organisasi'
    case 'org_admin':
      return 'Admin organisasi'
    default:
      return role
  }
}

/** Boleh mengelola anggota/turnamen (termasuk lewat organisasi). */
export function bisaKelola(role: string): boolean {
  return ['owner', 'admin', 'org_owner', 'org_admin'].includes(role)
}

/** Boleh mengubah/menghapus klub & mengatur peran. */
export function bisaAturKlub(role: string): boolean {
  return ['owner', 'org_owner'].includes(role)
}
