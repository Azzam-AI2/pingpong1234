import { useCallback, useEffect, useState } from 'react'
import { Kartu, Pilih, Tombol } from './ui'
import { labelPeran } from '../lib/auth'
import { daftarMenunggu, tolakPendaftar, tugaskanPendaftar, type Pendaftar } from '../lib/pendaftaran'

interface KlubKelola {
  id: string
  name: string
  role: string
}

/**
 * Antrean pendaftar untuk owner/admin: pilih klub + peran, lalu tugaskan.
 *
 * Semua keputusan izin ada di database (RPC tugaskan_pendaftar memeriksa
 * has_perm + batas peran), jadi menyembunyikan tombol bukan pengamanan.
 */
export function PendaftarMasuk({ klub }: { klub: KlubKelola[] }) {
  const [daftar, setDaftar] = useState<Pendaftar[]>([])
  const [pilihan, setPilihan] = useState<Record<string, { club: string; role: string }>>({})
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)

  const bolehLihat = klub.length > 0

  const muat = useCallback(async () => {
    if (!bolehLihat) return
    setDaftar(await daftarMenunggu())
  }, [bolehLihat])

  useEffect(() => {
    void muat()
  }, [muat])

  if (!bolehLihat || daftar.length === 0) return null

  const atur = (id: string, bagian: 'club' | 'role', nilai: string) => {
    setPilihan((lama) => ({
      ...lama,
      [id]: {
        club: bagian === 'club' ? nilai : (lama[id]?.club ?? klub[0].id),
        role: bagian === 'role' ? nilai : (lama[id]?.role ?? 'member'),
      },
    }))
  }

  async function tugaskan(p: Pendaftar) {
    const pilih = pilihan[p.id] ?? { club: klub[0].id, role: 'member' }
    setSibuk(p.id)
    setPesan(null)
    try {
      const hasil = await tugaskanPendaftar(p.id, pilih.club, pilih.role)
      setPesan(hasil.pesan ?? (hasil.ok ? 'Pendaftar ditugaskan.' : 'Gagal menugaskan.'))
      await muat()
    } finally {
      setSibuk(null)
    }
  }

  async function tolak(p: Pendaftar) {
    setSibuk(p.id)
    setPesan(null)
    try {
      const hasil = await tolakPendaftar(p.id)
      setPesan(hasil.pesan ?? 'Pendaftaran ditolak.')
      await muat()
    } finally {
      setSibuk(null)
    }
  }

  return (
    <Kartu>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Pendaftar menunggu penugasan</h2>
        <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-xs font-medium text-accent-900">
          {daftar.length} orang
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Mereka sudah punya akun tetapi belum bisa melihat data klub mana pun.
      </p>

      {pesan && (
        <p className="mt-3 rounded-xl border border-brand-600/30 bg-brand-600/10 px-3 py-2 text-sm text-brand-900">
          {pesan}
        </p>
      )}

      <ul className="mt-3 divide-y divide-ink/10">
        {daftar.map((p) => {
          const pilih = pilihan[p.id] ?? { club: klub[0].id, role: 'member' }
          const peranKlub = klub.find((k) => k.id === pilih.club)?.role ?? 'member'
          const opsiPeran = peranKlub === 'owner' || peranKlub === 'org_owner'
            ? ['member', 'official', 'admin', 'owner']
            : ['member', 'official']
          return (
            <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{p.nama || p.email}</p>
                <p className="truncate text-xs text-ink-muted">{p.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pilih
                  value={pilih.club}
                  onChange={(e) => atur(p.id, 'club', e.target.value)}
                  aria-label="Klub tujuan"
                  className="text-sm"
                >
                  {klub.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </Pilih>
                <Pilih
                  value={pilih.role}
                  onChange={(e) => atur(p.id, 'role', e.target.value)}
                  aria-label="Peran"
                  className="text-sm"
                >
                  {opsiPeran.map((r) => (
                    <option key={r} value={r}>
                      {labelPeran(r)}
                    </option>
                  ))}
                </Pilih>
                <Tombol kecil disabled={sibuk === p.id} onClick={() => void tugaskan(p)}>
                  {sibuk === p.id ? 'Memproses…' : 'Tugaskan'}
                </Tombol>
                <Tombol kecil variasi="sekunder" disabled={sibuk === p.id} onClick={() => void tolak(p)}>
                  Tolak
                </Tombol>
              </div>
            </li>
          )
        })}
      </ul>
    </Kartu>
  )
}
