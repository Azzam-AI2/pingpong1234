import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Snapshot, TableName } from '../types'
import { EMPTY_SNAPSHOT } from '../types'
import type { Op } from './mirror'

const URL_KUNCI = 'VITE_SUPABASE_URL'
const ANON_KUNCI = 'VITE_SUPABASE_ANON_KEY'

const KUNCI_MODE_LOKAL = 'pcm.paksa_lokal'

export interface KonfigurasiSupabase {
  status: 'siap' | 'belum-diatur' | 'kunci-terlarang' | 'url-tidak-valid'
  url: string
  anonKey: string
  pesan: string
}

function bacaPayloadJwt(token: string): Record<string, unknown> | null {
  try {
    const bagian = token.split('.')
    if (bagian.length < 2) return null
    const isi = bagian[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(isi + '='.repeat((4 - (isi.length % 4)) % 4))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Cek env Supabase + tolak service_role key sejak awal. */
export function bacaKonfigurasiSupabase(env = import.meta.env): KonfigurasiSupabase {
  const url = String(env[URL_KUNCI] ?? '').trim()
  const anonKey = String(env[ANON_KUNCI] ?? '').trim()

  if (!url || !anonKey) {
    return {
      status: 'belum-diatur',
      url: '',
      anonKey: '',
      pesan: 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi di file .env',
    }
  }
  if (!/^https?:\/\//i.test(url) || /\s/.test(url)) {
    return { status: 'url-tidak-valid', url, anonKey, pesan: `URL Supabase tidak valid: ${url}` }
  }
  const payload = bacaPayloadJwt(anonKey)
  if (payload && typeof payload.role === 'string' && payload.role !== 'anon') {
    return {
      status: 'kunci-terlarang',
      url,
      anonKey,
      pesan:
        `Kunci yang dipasang berperan "${payload.role}", bukan "anon". ` +
        'Kunci service_role TIDAK boleh berada di frontend karena melewati semua policy keamanan. ' +
        'Ganti dengan anon public key.',
    }
  }
  return { status: 'siap', url, anonKey, pesan: 'Konfigurasi Supabase terbaca.' }
}

/** Pengguna memilih mode lokal dari tombol di banner. */
export function paksaModeLokal(aktif = true) {
  try {
    if (aktif) localStorage.setItem(KUNCI_MODE_LOKAL, '1')
    else localStorage.removeItem(KUNCI_MODE_LOKAL)
  } catch {
    /* diabaikan: hanya preferensi UI */
  }
}

export function sedangPaksaModeLokal(): boolean {
  try {
    return localStorage.getItem(KUNCI_MODE_LOKAL) === '1'
  } catch {
    return false
  }
}

/** Penyimpanan online melalui Supabase (REST). */
export class SupabaseBackend {
  readonly kind = 'supabase' as const
  private client: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  private cek(error: { message: string } | null, aksi: string) {
    if (error) throw new Error(`Supabase menolak ${aksi}: ${error.message}`)
  }

  /**
   * Beri batas waktu supaya UI tidak menggantung tanpa kabar saat jaringan mati.
   * (Permintaan yang sudah terkirim tidak bisa dibatalkan, tetapi pengguna
   *  langsung tahu bahwa sinkronisasi gagal.)
   */
  private async denganBatas<T>(kerja: Promise<T>, ms: number, aksi: string): Promise<T> {
    let timer = 0
    const batas = new Promise<never>((_, tolak) => {
      timer = window.setTimeout(
        () => tolak(new Error(`Timeout ${Math.round(ms / 1000)} detik saat ${aksi}. Periksa koneksi.`)),
        ms,
      )
    })
    try {
      return await Promise.race([kerja, batas])
    } finally {
      window.clearTimeout(timer)
    }
  }

  async loadAll(): Promise<Snapshot> {
    const tabel: TableName[] = [
      'clubs',
      'members',
      'tournaments',
      'participants',
      'knockout_matches',
      'americano_rounds',
      'americano_matches',
      'league_rounds',
      'league_matches',
    ]
    const hasil = await this.denganBatas(
      Promise.all(
        tabel.map(async (t) => {
          const { data, error } = await this.client.from(t).select('*')
          this.cek(error, `baca tabel ${t}`)
          return [t, data ?? []] as const
        }),
      ),
      12000,
      'memuat data dari Supabase',
    )
    const snap: Snapshot = { ...EMPTY_SNAPSHOT }
    for (const [t, rows] of hasil) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(snap as any)[t] = rows
    }
    return snap
  }

  async apply(ops: Op[]): Promise<void> {
    await this.denganBatas(this.terapkan(ops), 15000, 'menyimpan perubahan ke Supabase')
  }

  private async terapkan(ops: Op[]): Promise<void> {
    for (const op of ops) {
      if (op.type === 'insert' && op.row) {
        const { error } = await this.client.from(op.table).insert(op.row)
        this.cek(error, `simpan ${op.table}`)
      } else if (op.type === 'update' && op.id) {
        const { error } = await this.client.from(op.table).update(op.patch ?? {}).eq('id', op.id)
        this.cek(error, `ubah ${op.table}`)
      } else if (op.type === 'delete' && op.id) {
        const { error } = await this.client.from(op.table).delete().eq('id', op.id)
        this.cek(error, `hapus ${op.table}`)
      }
    }
  }

  async ping(): Promise<void> {
    const { error } = await this.client.from('clubs').select('id').limit(1)
    if (error) {
      throw new Error(
        `${error.message}. Pastikan schema.sql sudah dijalankan dan kunci anon benar.`,
      )
    }
  }
}
