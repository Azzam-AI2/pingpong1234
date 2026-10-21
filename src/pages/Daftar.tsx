import { useState } from 'react'
import { Input, Kartu, Kolom, Tombol } from '../components/ui'
import { NAMA_APLIKASI } from '../lib/merek'
import { daftarAkun } from '../lib/pendaftaran'

/**
 * Pendaftaran mandiri: email + sandi.
 * Akun yang dibuat BELUM punya akses klub — owner/admin menugaskan klub & peran.
 */
export default function Daftar() {
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [ulangi, setUlangi] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [sukses, setSukses] = useState<string | null>(null)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setGalat(null)
    setSukses(null)
    if (sandi !== ulangi) {
      setGalat('Kedua sandi belum sama.')
      return
    }
    setSibuk(true)
    try {
      const hasil = await daftarAkun(email, sandi, nama)
      if (!hasil.ok) {
        setGalat(hasil.pesan ?? 'Gagal mendaftar.')
        return
      }
      setSukses(hasil.pesan ?? 'Akun dibuat.')
      setNama('')
      setEmail('')
      setSandi('')
      setUlangi('')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-xl">🏓</span>
        <div>
          <p className="text-base font-bold tracking-tight text-ink">{NAMA_APLIKASI}</p>
          <p className="text-xs text-ink-muted">Buat akun untuk ikut serta di klub</p>
        </div>
      </div>

      <Kartu>
        <h1 className="text-lg font-semibold text-ink">Daftar akun</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Setelah mendaftar, akunmu menunggu ditugaskan ke klub oleh pemilik klub. Kamu baru bisa melihat
          data klub setelah itu.
        </p>

        <form className="mt-4 space-y-3" onSubmit={kirim}>
          <Kolom label="Nama" petunjuk="Nama yang tampil di daftar anggota.">
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama kamu" />
          </Kolom>
          <Kolom label="Email" wajib>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@contoh.com"
            />
          </Kolom>
          <Kolom label="Sandi" wajib petunjuk="Minimal 6 karakter.">
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              placeholder="••••••••"
            />
          </Kolom>
          <Kolom label="Ulangi sandi" wajib>
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={ulangi}
              onChange={(e) => setUlangi(e.target.value)}
              placeholder="••••••••"
            />
          </Kolom>

          {galat && (
            <p className="rounded-xl border border-rose-600/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
              {galat}
            </p>
          )}
          {sukses && (
            <p className="rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
              {sukses}
            </p>
          )}

          <Tombol type="submit" penuh disabled={sibuk}>
            {sibuk ? 'Mendaftarkan…' : 'Daftar'}
          </Tombol>
        </form>

        <div className="mt-4 text-sm">
          Sudah punya akun?{' '}
          <a href="#/masuk" className="text-brand-800 underline">
            Masuk di sini
          </a>
        </div>
      </Kartu>

      <p className="text-center text-xs text-ink-muted">
        Pemilik klub akan menugaskanmu ke klub dan peran yang sesuai (anggota, petugas pertandingan,
        admin, atau pemilik).
      </p>
    </div>
  )
}
