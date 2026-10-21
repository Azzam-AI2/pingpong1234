import { klienAuth } from './auth'

/**
 * Pemanggil Edge Function undangan.
 *
 * Nama fungsi bisa berbeda antar-project (mis. `invite-member` atau nama acak
 * yang dibuat dashboard), jadi daftar kandidat dicoba berurutan dan nama yang
 * berhasil diingat untuk pemanggilan berikutnya. Nama pertama bisa dipaksa
 * lewat env `VITE_EDGE_UNDANG`.
 */
const KANDIDAT: string[] = Array.from(
  new Set(
    [
      String(import.meta.env.VITE_EDGE_UNDANG ?? '').trim(),
      'invite-member',
      'bright-function',
    ].filter(Boolean),
  ),
)

let namaAktif: string | null = null

export interface HasilFungsi<T = Record<string, unknown>> {
  ok: boolean
  pesan?: string
  status?: string
  data?: T
}

export async function panggilUndangan<T = Record<string, unknown>>(
  muatan: Record<string, unknown>,
): Promise<HasilFungsi<T>> {
  const klien = klienAuth()
  if (!klien) return { ok: false, pesan: 'Supabase belum dikonfigurasi.' }

  const { data: sesi } = await klien.auth.getSession()
  const token = sesi.session?.access_token
  if (!token) return { ok: false, pesan: 'Sesi tidak ditemukan. Masuk ulang.' }

  const dasar = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const kunciAnon = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '')

  const urutan = namaAktif ? [namaAktif, ...KANDIDAT.filter((n) => n !== namaAktif)] : KANDIDAT

  for (const nama of urutan) {
    let res: Response
    try {
      res = await fetch(`${dasar}/functions/v1/${nama}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: kunciAnon,
        },
        body: JSON.stringify(muatan),
      })
    } catch {
      return { ok: false, pesan: 'Tidak bisa menghubungi server. Periksa koneksi internet.' }
    }

    // 404 = nama fungsi tidak ada -> coba kandidat berikutnya.
    if (res.status === 404) continue

    const isi = (await res.json().catch(() => ({}))) as Record<string, unknown>
    namaAktif = nama

    if (!res.ok) {
      return {
        ok: false,
        pesan: typeof isi.pesan === 'string' ? isi.pesan : `Gagal memproses (HTTP ${res.status}).`,
      }
    }
    return {
      ok: isi.ok !== false,
      pesan: typeof isi.pesan === 'string' ? isi.pesan : undefined,
      status: typeof isi.status === 'string' ? isi.status : undefined,
      data: isi as T,
    }
  }

  return {
    ok: false,
    pesan: 'Fungsi undangan belum ter-deploy di Supabase (Edge Function belum ada).',
  }
}

export interface UndanganKlub {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  created_at: string
}
