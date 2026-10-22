import { useCallback, useEffect, useState } from 'react'
import { Kartu, Lencana, Pilih, Tombol } from './ui'
import { bisaKelola, klubSaya, labelPeran, modeOnline } from '../lib/auth'
import {
  anggotaAkun,
  bolehKelolaPeran,
  labelStatusAnggota,
  opsiPeran,
  tombolPeranNonaktif,
  ubahPeran,
  ubahStatus,
  type AnggotaAkun,
} from '../lib/kelolaAnggota'
import { formatTanggal } from '../lib/utils'

/**
 * Kelola anggota yang punya akun: ubah peran, tangguhkan, aktifkan, keluarkan.
 * Semua keputusan izin tetap di database (RPC sql/024); komponen ini hanya
 * menampilkan tombol yang masuk akal.
 */
export function KelolaAnggotaAkun({ klubId }: { klubId?: string }) {
  const [peranSaya, setPeranSaya] = useState<string | null>(null)
  const [diperiksa, setDiperiksa] = useState(false)
  const [daftar, setDaftar] = useState<AnggotaAkun[]>([])
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [pilihan, setPilihan] = useState<Record<string, string>>({})

  const daring = modeOnline()

  useEffect(() => {
    if (!daring || !klubId) {
      setDiperiksa(true)
      return
    }
    let hidup = true
    void klubSaya().then((rows) => {
      if (!hidup) return
      setPeranSaya(rows.find((r) => r.club_id === klubId)?.role ?? null)
      setDiperiksa(true)
    })
    return () => {
      hidup = false
    }
  }, [daring, klubId])

  const boleh = Boolean(peranSaya && bisaKelola(peranSaya))
  const bolehAturPeran = bolehKelolaPeran(peranSaya)

  const muat = useCallback(async () => {
    if (!klubId || !boleh) return
    const rows = await anggotaAkun(klubId)
    setDaftar(rows)
    setPilihan(Object.fromEntries(rows.map((r) => [r.user_id, r.role])))
  }, [klubId, boleh])

  useEffect(() => {
    void muat()
  }, [muat])

  if (!daring || !diperiksa || !boleh) return null

  const jumlahOwnerAktif = daftar.filter((a) => a.role === 'owner' && a.status === 'active').length

  async function simpanPeran(a: AnggotaAkun) {
    const baru = pilihan[a.user_id] ?? a.role
    if (baru === a.role || !klubId) return
    setSibuk(a.user_id)
    setGalat(null)
    setPesan(null)
    try {
      const hasil = await ubahPeran(klubId, a.user_id, baru)
      if (!hasil.ok) setGalat(hasil.pesan ?? 'Gagal mengubah peran.')
      else {
        setPesan(hasil.pesan ?? 'Peran diperbarui.')
        await muat()
      }
    } finally {
      setSibuk(null)
    }
  }

  async function ubahKe(a: AnggotaAkun, status: 'active' | 'suspended' | 'left') {
    if (!klubId) return
    setSibuk(a.user_id)
    setGalat(null)
    setPesan(null)
    try {
      const hasil = await ubahStatus(klubId, a.user_id, status)
      if (!hasil.ok) setGalat(hasil.pesan ?? 'Gagal mengubah status.')
      else {
        setPesan(hasil.pesan ?? 'Status diperbarui.')
        await muat()
      }
    } finally {
      setSibuk(null)
    }
  }

  return (
    <Kartu>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Akun & peran anggota</h2>
        <Lencana warna="netral">{daftar.length} akun</Lencana>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Daftar ini berisi orang yang punya akun di klub. Ubah peran untuk memberi hak (mis. petugas
        pertandingan), atau tangguhkan bila tidak lagi aktif.
      </p>

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

      <ul className="mt-3 divide-y divide-ink/10">
        {daftar.map((a) => {
          const kunci = tombolPeranNonaktif(a.role, a.status, jumlahOwnerAktif)
          const sedang = sibuk === a.user_id
          return (
            <li key={a.user_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{a.nama || a.email}</p>
                <p className="truncate text-xs text-ink-muted">
                  {a.email}
                  {a.joined_at ? ` · sejak ${formatTanggal(a.joined_at.slice(0, 10))}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Lencana
                  warna={
                    a.status === 'active' ? 'hijau' : a.status === 'suspended' ? 'merah' : 'netral'
                  }
                >
                  {labelStatusAnggota(a.status)}
                </Lencana>

                {bolehAturPeran ? (
                  <>
                    <Pilih
                      value={pilihan[a.user_id] ?? a.role}
                      onChange={(e) =>
                        setPilihan((lama) => ({ ...lama, [a.user_id]: e.target.value }))
                      }
                      aria-label={`Peran ${a.email}`}
                      className="text-sm"
                      disabled={sedang || kunci}
                    >
                      {opsiPeran(peranSaya ?? '').map((r) => (
                        <option key={r} value={r}>
                          {labelPeran(r)}
                        </option>
                      ))}
                    </Pilih>
                    <Tombol
                      kecil
                      disabled={sedang || kunci || (pilihan[a.user_id] ?? a.role) === a.role}
                      onClick={() => void simpanPeran(a)}
                    >
                      Simpan peran
                    </Tombol>
                  </>
                ) : (
                  <Lencana warna="biru">{labelPeran(a.role)}</Lencana>
                )}

                {a.status === 'active' ? (
                  <Tombol
                    kecil
                    variasi="sekunder"
                    disabled={sedang || kunci}
                    onClick={() => void ubahKe(a, 'suspended')}
                  >
                    Tangguhkan
                  </Tombol>
                ) : (
                  <Tombol
                    kecil
                    variasi="sekunder"
                    disabled={sedang}
                    onClick={() => void ubahKe(a, 'active')}
                  >
                    Aktifkan
                  </Tombol>
                )}

                {a.status !== 'left' && (
                  <Tombol kecil variasi="bahaya" disabled={sedang || kunci} onClick={() => void ubahKe(a, 'left')}>
                    Keluarkan
                  </Tombol>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {bolehAturPeran && jumlahOwnerAktif <= 1 && (
        <p className="mt-3 text-xs text-ink-muted">
          Kamu satu-satunya pemilik aktif. Angkat pemilik lain dulu kalau ingin mengubah peranmu
          sendiri — ini aturan pengaman agar klub tidak pernah tanpa pemilik.
        </p>
      )}
    </Kartu>
  )
}
