import { useEffect, useState } from 'react'

/**
 * Struktur navigasi: klub adalah hierarki tertinggi.
 *
 *   #/                                  daftar klub (pilih klub dulu)
 *   #/klub/<id>                         beranda klub
 *   #/klub/<id>/anggota                 anggota klub
 *   #/klub/<id>/turnamen                daftar turnamen klub
 *   #/klub/<id>/turnamen/<tid>          detail turnamen
 *   #/klub/<id>/leaderboard             leaderboard klub
 *   #/penyimpanan                       status penyimpanan & integrasi Supabase
 *
 * Tautan bisa menambah ?aksi=... untuk langsung membuka form (mis. buka modal).
 */
export type NamaHalaman =
  | 'pilih-klub'
  | 'beranda'
  | 'anggota'
  | 'turnamen'
  | 'detail'
  | 'leaderboard'
  | 'undangan'
  | 'atur-sandi'
  | 'daftar'
  | 'penyimpanan'

export interface Rute {
  halaman: NamaHalaman
  klubId?: string
  id?: string
  aksi?: string
}

export interface Target {
  halaman: NamaHalaman
  klubId?: string
  id?: string
  aksi?: string
}

function parse(hash: string): Rute {
  const bersih = hash.replace(/^#\/?/, '').trim()
  if (!bersih) return { halaman: 'pilih-klub' }
  const [jalur, query] = bersih.split('?')
  const aksi = new URLSearchParams(query ?? '').get('aksi') ?? undefined
  const bagian = jalur.split('/').filter(Boolean)

  if (bagian[0] === 'penyimpanan' || bagian[0] === 'supabase') {
    return { halaman: 'penyimpanan', aksi }
  }

  if (bagian[0] === 'undangan') {
    return { halaman: 'undangan', aksi }
  }

  if (bagian[0] === 'atur-sandi') {
    return { halaman: 'atur-sandi', aksi }
  }

  if (bagian[0] === 'daftar') {
    return { halaman: 'daftar', aksi }
  }

  if (bagian[0] === 'klub' && bagian[1]) {
    const klubId = bagian[1]
    switch (bagian[2]) {
      case undefined:
        return { halaman: 'beranda', klubId, aksi }
      case 'anggota':
        return { halaman: 'anggota', klubId, aksi }
      case 'turnamen':
        return bagian[3]
          ? { halaman: 'detail', klubId, id: bagian[3], aksi }
          : { halaman: 'turnamen', klubId, aksi }
      case 'leaderboard':
        return { halaman: 'leaderboard', klubId, aksi }
      default:
        return { halaman: 'beranda', klubId, aksi }
    }
  }

  return { halaman: 'pilih-klub', aksi }
}

export function keHash(target: Target): string {
  const q = target.aksi ? `?aksi=${encodeURIComponent(target.aksi)}` : ''
  switch (target.halaman) {
    case 'penyimpanan':
      return `#/penyimpanan${q}`
    case 'undangan':
      return `#/undangan${q}`
    case 'atur-sandi':
      return `#/atur-sandi${q}`
    case 'daftar':
      return `#/daftar${q}`
    case 'pilih-klub':
      return `#/${q}`
    case 'beranda':
      return target.klubId ? `#/klub/${target.klubId}${q}` : `#/${q}`
    case 'anggota':
      return target.klubId ? `#/klub/${target.klubId}/anggota${q}` : `#/${q}`
    case 'turnamen':
      return target.klubId ? `#/klub/${target.klubId}/turnamen${q}` : `#/${q}`
    case 'detail':
      return target.klubId && target.id
        ? `#/klub/${target.klubId}/turnamen/${target.id}${q}`
        : target.klubId
          ? `#/klub/${target.klubId}/turnamen${q}`
          : `#/${q}`
    case 'leaderboard':
      return target.klubId ? `#/klub/${target.klubId}/leaderboard${q}` : `#/${q}`
    default:
      return `#/${q}`
  }
}

export function pakaiRute(): [Rute, (target: Target) => void] {
  const [rute, setRute] = useState<Rute>(() => parse(window.location.hash))

  useEffect(() => {
    const ubah = () => setRute(parse(window.location.hash))
    window.addEventListener('hashchange', ubah)
    return () => window.removeEventListener('hashchange', ubah)
  }, [])

  const pindah = (target: Target) => {
    const tujuan = keHash(target)
    if (window.location.hash !== tujuan) window.location.hash = tujuan
    else setRute(parse(tujuan))
    window.scrollTo({ top: 0 })
  }

  return [rute, pindah]
}

/** Hapus parameter ?aksi= dari URL tanpa memicu muat ulang halaman. */
export function bersihkanAksi() {
  const hash = window.location.hash
  if (!hash.includes('?aksi=')) return
  const bersih = hash.split('?')[0]
  window.history.replaceState(null, '', bersih || '#/')
}
