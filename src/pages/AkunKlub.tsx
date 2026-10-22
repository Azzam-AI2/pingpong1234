import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { Input, Kartu, Kolom, Kosong, Pilih, Tombol } from '../components/ui'
import { KelolaAnggotaAkun } from '../components/KelolaAnggotaAkun'
import { KelolaUndangan } from '../components/KelolaUndangan'
import { PendaftarMasuk } from '../components/PendaftarMasuk'
import { bisaKelola, klubSaya, labelPeran, modeOnline } from '../lib/auth'
import { opsiPeran } from '../lib/kelolaAnggota'
import { tambahAkunKeKlub } from '../lib/akunKlub'
import { panggilUndangan } from '../lib/undanganApi'

/**
 * Halaman Akun klub (khusus owner/admin):
 *  - tambahkan akun yang sudah ada ke klub ini (pilih peran)
 *  - undang email yang belum punya akun
 *  - ubah peran / tangguhkan / keluarkan anggota
 *  - proses pendaftar yang menunggu penugasan
 */
export default function AkunKlub() {
  const { klubAktif, pesan } = useApp()
  const [peranSaya, setPeranSaya] = useState<string | null>(null)
  const [diperiksa, setDiperiksa] = useState(false)
  const [email, setEmail] = useState('')
  const [peran, setPeran] = useState('member')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  const daring = modeOnline()

  useEffect(() => {
    if (!daring || !klubAktif) {
      setDiperiksa(true)
      return
    }
    let hidup = true
    void klubSaya().then((rows) => {
      if (!hidup) return
      setPeranSaya(rows.find((r) => r.club_id === klubAktif.id)?.role ?? null)
      setDiperiksa(true)
    })
    return () => {
      hidup = false
    }
  }, [daring, klubAktif])

  if (!klubAktif) {
    return <Kosong judul="Klub belum dipilih" pesan="Buka salah satu klub dulu, lalu masuk ke menu Akun." />
  }

  if (!diperiksa) {
    return <div className="h-24 animate-pulse rounded-2xl bg-ink/6" />
  }

  if (!daring || !peranSaya || !bisaKelola(peranSaya)) {
    return (
      <Kosong
        judul="Hanya pengelola klub"
        pesan="Halaman ini untuk pemilik dan admin klub. Minta pemilik klub menaikkan peranmu bila kamu perlu mengelola akun anggota."
      />
    )
  }

  const pilihanPeran = opsiPeran(peranSaya)

  async function tambah(e: React.FormEvent) {
    e.preventDefault()
    if (!klubAktif) return
    setSibuk(true)
    setGalat(null)
    try {
      const hasil = await tambahAkunKeKlub(klubAktif.id, email, peran)
      if (hasil.ok) {
        pesan(hasil.pesan ?? 'Akun ditambahkan ke klub.', 'sukses')
        setEmail('')
        return
      }
      if (hasil.perluUndang) {
        const undangan = await panggilUndangan({
          aksi: 'undang',
          club_id: klubAktif.id,
          email,
          role: peran,
        })
        pesan(
          undangan.ok
            ? (undangan.pesan ?? `Undangan dikirim ke ${email}.`)
            : `Belum punya akun, dan undangan gagal: ${undangan.pesan ?? 'tidak diketahui'}`,
          undangan.ok ? 'sukses' : 'error',
        )
        setEmail('')
        return
      }
      setGalat(hasil.pesan ?? 'Gagal menambahkan akun.')
    } finally {
      setSibuk(false)
    }
  }

  const klubKelola = [
    { id: klubAktif.id, name: klubAktif.name, role: peranSaya },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Akun & akses — {klubAktif.name}</h1>
        <p className="text-sm text-ink-muted">
          Kamu masuk sebagai <b>{labelPeran(peranSaya)}</b>. Di sini kamu bisa memberi akses ke klub
          ini, mengubah peran, dan menangguhkan anggota.
        </p>
      </div>

      <Kartu>
        <h2 className="text-base font-semibold text-ink">Tambah akun ke klub ini</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Untuk orang yang <b>sudah punya akun</b>: langsung dijadikan anggota dengan peran pilihan.
          Kalau belum punya akun, undangan dikirim otomatis ke emailnya.
        </p>

        <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={tambah}>
          <div className="flex-1">
            <Kolom label="Email akun" wajib>
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
              <Pilih value={peran} onChange={(e) => setPeran(e.target.value)}>
                {pilihanPeran.map((p) => (
                  <option key={p} value={p}>
                    {labelPeran(p)}
                  </option>
                ))}
              </Pilih>
            </Kolom>
          </div>
          <Tombol type="submit" disabled={sibuk}>
            {sibuk ? 'Memproses…' : 'Tambahkan'}
          </Tombol>
        </form>

        {galat && (
          <p className="mt-3 rounded-xl border border-rose-600/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
            {galat}
          </p>
        )}
      </Kartu>

      <KelolaAnggotaAkun klubId={klubAktif.id} />
      <KelolaUndangan klubId={klubAktif.id} />
      <PendaftarMasuk klub={klubKelola} />
    </div>
  )
}
