import type { Snapshot, TableName } from '../types'
import { LocalBackend } from './local'
import {
  bacaKonfigurasiSupabase,
  sedangPaksaModeLokal,
  SupabaseBackend,
} from './supabase'
import type { Op } from './mirror'

export type { Op } from './mirror'
export {
  bacaKonfigurasiSupabase,
  bacaOverrideSupabase,
  paksaModeLokal,
  simpanOverrideSupabase,
  sedangPaksaModeLokal,
  validasiKonfigurasi,
} from './supabase'

export interface Backend {
  readonly kind: 'supabase' | 'local'
  loadAll(): Promise<Snapshot>
  apply(ops: Op[]): Promise<void>
  ping(): Promise<void>
}

export interface InfoPenyimpanan {
  mode: 'supabase' | 'local'
  judul: string
  keterangan: string
  peringatan: string | null
}

/** Pilih backend: Supabase kalau dikonfigurasi, kalau tidak -> penyimpanan lokal. */
export function pilihBackend(): {
  backend: Backend
  info: InfoPenyimpanan
  masalahKonfigurasi: string | null
} {
  const cfg = bacaKonfigurasiSupabase()
  const dipaksaLokal = sedangPaksaModeLokal()

  if (cfg.status === 'kunci-terlarang' || cfg.status === 'url-tidak-valid') {
    return {
      backend: new LocalBackend(),
      info: {
        mode: 'local',
        judul: 'Mode lokal (konfigurasi Supabase ditolak)',
        keterangan:
          'Data disimpan di browser ini saja. Perbaiki konfigurasi Supabase lalu muat ulang halaman.',
        peringatan: cfg.pesan,
      },
      masalahKonfigurasi: cfg.pesan,
    }
  }

  if (cfg.status === 'siap' && !dipaksaLokal) {
    return {
      backend: new SupabaseBackend(cfg.url, cfg.anonKey),
      info: {
        mode: 'supabase',
        judul: 'Online · Supabase',
        keterangan: 'Data tersimpan di database Supabase dan bisa diakses anggota lain lewat browser.',
        peringatan: null,
      },
      masalahKonfigurasi: null,
    }
  }

  return {
    backend: new LocalBackend(),
    info: {
      mode: 'local',
      judul: 'Mode lokal (belum terhubung ke Supabase)',
      keterangan:
        'Data disimpan di browser ini saja dan tetap ada setelah dimuat ulang, tetapi belum online dan belum bisa diakses anggota lain.',
      peringatan: null,
    },
    masalahKonfigurasi: null,
  }
}

export function namaTabelPendukung(): TableName[] {
  return [
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
}
