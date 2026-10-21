import { useState } from 'react'
import { Kartu, Input, Kolom, Tombol } from '../components/ui'
import { masuk, mintaResetSandi } from '../lib/auth'

/**
 * Layar masuk. Akun tidak dibuat di sini: pemilik/admin klub mengundang lewat
 * email, lalu penerima menetapkan sandi dari tautan undangan.
 */
export default function Masuk() {
  const [mode, setMode] = useState<'masuk' | 'lupa'>('masuk')
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setGalat(null)
    setInfo(null)
    setSibuk(true)
    try {
      if (mode === 'lupa') {
        const hasil = await mintaResetSandi(email)
        if (!hasil.ok) setGalat(hasil.pesan ?? 'Gagal mengirim email reset.')
        else setInfo('Kalau email itu terdaftar, tautan pengaturan sandi sudah dikirim. Cek kotak masuk.')
      } else {
        const hasil = await masuk(email, sandi)
        if (!hasil.ok) setGalat(hasil.pesan ?? 'Gagal masuk.')
        else setInfo('Berhasil masuk. Memuat data…')
      }
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-xl">🏓</span>
        <div>
          <p className="text-base font-bold tracking-tight text-ink">Pingpong Club Manager</p>
          <p className="text-xs text-ink-muted">Kelola klub, turnamen, dan skor</p>
        </div>
      </div>

      <Kartu>
        <h1 className="text-lg font-semibold text-ink">
          {mode === 'masuk' ? 'Masuk ke akunmu' : 'Lupa sandi'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {mode === 'masuk'
            ? 'Gunakan email dan sandi yang kamu buat saat menerima undangan klub.'
            : 'Masukkan email akunmu, kami kirim tautan untuk membuat sandi baru.'}
        </p>

        <form className="mt-4 space-y-3" onSubmit={kirim}>
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

          {mode === 'masuk' && (
            <Kolom label="Sandi" wajib>
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={sandi}
                onChange={(e) => setSandi(e.target.value)}
                placeholder="••••••••"
              />
            </Kolom>
          )}

          {galat && (
            <p className="rounded-xl border border-rose-600/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
              {galat}
            </p>
          )}
          {info && (
            <p className="rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
              {info}
            </p>
          )}

          <Tombol type="submit" penuh disabled={sibuk}>
            {sibuk ? 'Memproses…' : mode === 'masuk' ? 'Masuk' : 'Kirim tautan reset'}
          </Tombol>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            className="text-brand-800 underline"
            onClick={() => {
              setMode(mode === 'masuk' ? 'lupa' : 'masuk')
              setGalat(null)
              setInfo(null)
            }}
          >
            {mode === 'masuk' ? 'Lupa sandi?' : 'Kembali ke halaman masuk'}
          </button>
        </div>
      </Kartu>

      <p className="text-center text-xs text-ink-muted">
        Belum punya akun? Akun dibuat lewat undangan pemilik atau admin klub. Minta mereka mengundang
        emailmu, lalu buka tautan undangan di kotak masuk.
      </p>
    </div>
  )
}
