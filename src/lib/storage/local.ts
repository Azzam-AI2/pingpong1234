import type { Snapshot } from '../types'
import { EMPTY_SNAPSHOT } from '../types'
import { terapkanKeSnapshot, type Op } from './mirror'

const KUNCI = 'pcm.db.v1'

function baca(): Snapshot {
  try {
    const raw = localStorage.getItem(KUNCI)
    if (!raw) return { ...EMPTY_SNAPSHOT }
    const parsed = JSON.parse(raw) as Partial<Snapshot>
    return { ...EMPTY_SNAPSHOT, ...parsed }
  } catch {
    return { ...EMPTY_SNAPSHOT }
  }
}

function tulis(data: Snapshot) {
  localStorage.setItem(KUNCI, JSON.stringify(data))
}

/**
 * Penyimpanan lokal (localStorage) untuk mode tanpa Supabase.
 * Semua perubahan langsung ditulis ke browser sehingga data tetap ada
 * setelah halaman dimuat ulang — tetapi hanya di browser/perangkat ini.
 */
export class LocalBackend {
  readonly kind = 'local' as const
  private db: Snapshot

  constructor() {
    this.db = baca()
  }

  async loadAll(): Promise<Snapshot> {
    this.db = baca()
    return JSON.parse(JSON.stringify(this.db)) as Snapshot
  }

  async apply(ops: Op[]): Promise<void> {
    const next = terapkanKeSnapshot(this.db, ops)
    tulis(next)
    this.db = next
  }

  async ping(): Promise<void> {
    // mode lokal selalu tersedia; hanya cek kuota tulis
    try {
      localStorage.setItem('pcm.ping', String(Date.now()))
      localStorage.removeItem('pcm.ping')
    } catch {
      throw new Error('Penyimpanan browser tidak bisa dipakai (mode privat atau kuota penuh).')
    }
  }

  async hapusSemua(): Promise<void> {
    tulis({ ...EMPTY_SNAPSHOT })
    this.db = { ...EMPTY_SNAPSHOT }
  }
}
