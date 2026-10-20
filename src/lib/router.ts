import { useEffect, useState } from 'react'

export type NamaHalaman = 'dashboard' | 'klub' | 'turnamen' | 'detail' | 'leaderboard' | 'supabase'

export interface Rute {
  halaman: NamaHalaman
  id?: string
}

function parse(hash: string): Rute {
  const bersih = hash.replace(/^#\/?/, '').trim()
  if (!bersih) return { halaman: 'dashboard' }
  const bagian = bersih.split('/')
  switch (bagian[0]) {
    case 'klub':
      return { halaman: 'klub' }
    case 'turnamen':
      return bagian[1] ? { halaman: 'detail', id: bagian[1] } : { halaman: 'turnamen' }
    case 'leaderboard':
      return { halaman: 'leaderboard' }
    case 'supabase':
      return { halaman: 'supabase' }
    default:
      return { halaman: 'dashboard' }
  }
}

export function keHash(halaman: NamaHalaman, id?: string): string {
  switch (halaman) {
    case 'klub':
      return '#/klub'
    case 'turnamen':
      return '#/turnamen'
    case 'leaderboard':
      return '#/leaderboard'
    case 'supabase':
      return '#/supabase'
    case 'detail':
      return id ? `#/turnamen/${id}` : '#/turnamen'
    default:
      return '#/'
  }
}

export function pakaiRute(): [Rute, (halaman: NamaHalaman, id?: string) => void] {
  const [rute, setRute] = useState<Rute>(() => parse(window.location.hash))

  useEffect(() => {
    const ubah = () => setRute(parse(window.location.hash))
    window.addEventListener('hashchange', ubah)
    return () => window.removeEventListener('hashchange', ubah)
  }, [])

  const pindah = (halaman: NamaHalaman, id?: string) => {
    const target = keHash(halaman, id)
    if (window.location.hash !== target) window.location.hash = target
    else setRute(parse(target))
    window.scrollTo({ top: 0 })
  }

  return [rute, pindah]
}
