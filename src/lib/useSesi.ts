import { useEffect, useState } from 'react'
import type { Session } from './auth'
import { pasangPendengarSesi, sesiSekarang, tanganiTautanAuth } from './auth'

/**
 * Pantau sesi Supabase Auth.
 * `memuat` true selama sesi pertama belum diketahui — jangan tampilkan
 * halaman klub sebelum tahu siapa penggunanya.
 */
export function useSesi(): { sesi: Session | null; memuat: boolean } {
  const [sesi, setSesi] = useState<Session | null>(null)
  const [memuat, setMemuat] = useState(true)

  useEffect(() => {
    let hidup = true
    let lepas: (() => void) | null = null

    void (async () => {
      try {
        await tanganiTautanAuth()
      } catch {
        /* tautan rusak — lanjut seperti biasa */
      }
      const awal = await sesiSekarang()
      if (!hidup) return
      setSesi(awal)
      setMemuat(false)
      lepas = pasangPendengarSesi((baru) => {
        if (hidup) setSesi(baru)
      })
    })()

    return () => {
      hidup = false
      lepas?.()
    }
  }, [])

  return { sesi, memuat }
}

/** Email pengguna yang sedang masuk (null kalau belum/tidak ada sesi). */
export function useEmailSesi(): string | null {
  const { sesi } = useSesi()
  return sesi?.user.email ?? null
}
