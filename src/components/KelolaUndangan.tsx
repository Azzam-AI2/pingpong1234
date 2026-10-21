import { useCallback, useEffect, useState } from 'react'
import { Input, Kartu, Kolom, Lencana, Pilih, Tombol } from './ui'
import { bisaAturKlub, bisaKelola, klubSaya, labelPeran, modeOnline } from '../lib/auth'
import { panggilUndangan, type UndanganKlub } from '../lib/undanganApi'

/**
 * Kelola undangan anggota untuk satu klub.
 *
 * Tampil hanya kalau pengguna punya izin `club.manage_members` menurut database.
 * Menyembunyikan UI bukan pengamanan: Edge Function tetap memeriksa izin yang sama,
 * jadi memanggil API langsung dari luar aplikasi tetap ditolak server.
 */
export function KelolaUndangan({ klubId }: { klubId?: string }) {
  const [peran, setPeran] = useState<string | null>(null)
  const [diperiksa, setDiperiksa] = useState(false)
  const [daftar, setDaftar] = useState<UndanganKlub[]>([])
  const [email, setEmail] = useState('')
  const [peranUndang, setPeranUndang] = useState('member')
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  const daring = modeOnline()

  useEffect(() => {
    if (!daring || !klubId) {
      setDiperiksa(true)
      return
    }
    let hidup = true
    void klubSaya().then((rows) => {
      if (!hidup) return
      setPeran(rows.find((r) => r.club_id === klubId)?.role ?? null)
      setDiperiksa(true)
    })
    return () => {
      hidup = false
    }
  }, [daring, klubId])

  const boleh = Boolean(peran && bisaKelola(peran))

  const muatDaftar = useCallback(async () => {
    if (!klubId || !boleh) return
    const hasil = await panggilUndangan<{ undangan?: UndanganKlub[] }>({
      aksi: 'daftar',
      club_id: klubId,
    })
    if (hasil.ok && Array.isArray(hasil.data?.undangan)) setDaftar(hasil.data!.undangan!)
  }, [klubId, boleh])

  useEffect(() => {
    void muatDaftar()
  }, [muatDaftar])

  async function undang(e: React.FormEvent) {
    e.preventDefault()
    if (!klubId) return
    setSibuk(true)
    setGalat(null)
    setPesan(null)
    try {
      const hasil = await panggilUndangan({ aksi: 'undang', club_id: klubId, email, role: peranUndang })
      if (!hasil.ok) setGalat(hasil.pesan ?? 'Gagal mengundang.')
      else {
        setPesan(hasil.pesan ?? 'Undangan diproses.')
        setEmail('')
        await muatDaftar()
      }
    } finally {
      setSibuk(false)
    }
  }

  async function batalkan(surel: string) {
    if (!klubId) return
    setSibuk(true)
    setGalat(null)
    setPesan(null)
    try {
      const hasil = await panggilUndangan({ aksi: 'batalkan', club_id: klubId, email: surel })
      if (!hasil.ok) setGalat(hasil.pesan ?? 'Gagal membatalkan undangan.')
      else {
        setPesan(hasil.pesan ?? 'Undangan dibatalkan.')
        await muatDaftar()
      }
    } finally {
      setSibuk(false)
    }
  }

  if (!daring || !diperiksa || !boleh) return null

  const pilihanPeran = peran && bisaAturKlub(peran) ? ['admin', 'official', 'member'] : ['official', 'member']

  return (
    <Kartu>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Undang anggota baru</h2>
        <Lencana warna="netral">kamu: {labelPeran(peran ?? '')}</Lencana>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Undangan dikirim ke email. Penerima menetapkan sandi dari tautan itu, lalu otomatis jadi anggota
        klub dengan peran yang kamu pilih.
      </p>

      <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={undang}>
        <div className="flex-1">
          <Kolom label="Email" wajib>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@contoh.com"
            />
          </Kolom>
        </div>
        <div className="sm:w-56">
          <Kolom label="Peran">
            <Pilih value={peranUndang} onChange={(e) => setPeranUndang(e.target.value)}>
              {pilihanPeran.map((p) => (
                <option key={p} value={p}>
                  {labelPeran(p)}
                </option>
              ))}
            </Pilih>
          </Kolom>
        </div>
        <Tombol type="submit" disabled={sibuk}>
          {sibuk ? 'Memproses…' : 'Undang'}
        </Tombol>
      </form>

      {galat && (
        <p className="mt-3 rounded-xl border border-rose-600/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
          {galat}
        </p>
      )}
      {pesan && (
        <p className="mt-3 rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
          {pesan}
        </p>
      )}

      {daftar.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">Undangan menunggu jawaban</p>
          <ul className="mt-2 divide-y divide-ink/10">
            {daftar
              .filter((u) => u.status === 'pending')
              .map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{u.email}</p>
                    <p className="text-xs text-ink-muted">
                      {labelPeran(u.role)} · dikirim {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <Tombol kecil variasi="sekunder" disabled={sibuk} onClick={() => void batalkan(u.email)}>
                    Batalkan
                  </Tombol>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Kartu>
  )
}
