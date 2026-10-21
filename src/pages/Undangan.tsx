import { useCallback, useEffect, useState } from 'react'
import { Kartu, Kosong, Lencana, Tombol } from '../components/ui'
import {
  labelPeran,
  sisaHari,
  terimaUndangan,
  tolakUndangan,
  undanganSaya,
  type Undangan as TUndangan,
} from '../lib/auth'

/**
 * Daftar undangan untuk email pengguna yang sedang masuk.
 * Dipakai di halaman #/undangan dan sebagai kartu di halaman daftar klub.
 */
export function DaftarUndangan({
  onBerubah,
  tampilkanKosong = false,
}: {
  onBerubah?: () => void
  tampilkanKosong?: boolean
}) {
  const [daftar, setDaftar] = useState<TUndangan[] | null>(null)
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)

  const muat = useCallback(async () => {
    setDaftar(await undanganSaya())
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  async function terima(id: string) {
    setSibuk(id)
    setPesan(null)
    try {
      const hasil = await terimaUndangan(id)
      if (hasil.ok) {
        setPesan(hasil.pesan ?? 'Undangan diterima. Klub baru sudah bisa dibuka.')
        await muat()
        onBerubah?.()
      } else {
        setPesan(hasil.pesan ?? 'Gagal menerima undangan.')
        await muat()
      }
    } finally {
      setSibuk(null)
    }
  }

  async function tolak(id: string) {
    setSibuk(id)
    setPesan(null)
    try {
      const hasil = await tolakUndangan(id)
      if (!hasil.ok) setPesan(hasil.pesan ?? 'Gagal menolak undangan.')
      await muat()
      onBerubah?.()
    } finally {
      setSibuk(null)
    }
  }

  if (daftar === null) {
    return <div className="h-16 animate-pulse rounded-2xl bg-ink/6" />
  }

  if (daftar.length === 0) {
    if (!tampilkanKosong) return null
    return (
      <Kosong
        judul="Belum ada undangan"
        pesan="Kalau pemilik atau admin klub mengundang emailmu, undangannya muncul di sini."
      />
    )
  }

  return (
    <div className="space-y-2">
      {pesan && (
        <p className="rounded-xl border border-brand-600/30 bg-brand-600/10 px-3 py-2 text-sm text-brand-900">
          {pesan}
        </p>
      )}
      {daftar.map((u) => (
        <Kartu key={u.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-ink">{u.club_name}</p>
                <Lencana warna="biru">{labelPeran(u.role)}</Lencana>
                <Lencana warna={sisaHari(u.expires_at) <= 1 ? 'merah' : 'kuning'}>
                  {sisaHari(u.expires_at) === 0
                    ? 'kedaluwarsa'
                    : `berlaku ${sisaHari(u.expires_at)} hari lagi`}
                </Lencana>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {u.invited_by_nama ? `Diundang oleh ${u.invited_by_nama}.` : 'Undangan klub.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Tombol kecil disabled={sibuk === u.id} onClick={() => void terima(u.id)}>
                {sibuk === u.id ? 'Memproses…' : 'Terima'}
              </Tombol>
              <Tombol kecil variasi="sekunder" disabled={sibuk === u.id} onClick={() => void tolak(u.id)}>
                Tolak
              </Tombol>
            </div>
          </div>
        </Kartu>
      ))}
    </div>
  )
}

export default function Undangan() {
  const [versi, setVersi] = useState(0)
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Undangan klub</h1>
        <p className="text-sm text-ink-muted">
          Undangan ditujukan ke email akunmu. Setelah diterima, klubnya langsung muncul di daftar klub.
        </p>
      </div>
      <div key={versi}>
        <DaftarUndangan tampilkanKosong onBerubah={() => setVersi((v) => v + 1)} />
      </div>
    </div>
  )
}
