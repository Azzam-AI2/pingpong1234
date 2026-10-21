import { useState } from 'react'
import { Kartu, Input, Kolom, Tombol } from '../components/ui'
import { aturSandiBaru } from '../lib/auth'

/**
 * Dipakai sesudah pengguna membuka tautan undangan / reset sandi dari email.
 * Tautan itu sudah membuat sesi sementara; di sini pengguna menetapkan sandi.
 */
export default function AturSandi() {
  const [sandi, setSandi] = useState('')
  const [ulangi, setUlangi] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setGalat(null)
    if (sandi !== ulangi) {
      setGalat('Kedua sandi belum sama.')
      return
    }
    setSibuk(true)
    try {
      const hasil = await aturSandiBaru(sandi)
      if (!hasil.ok) {
        setGalat(hasil.pesan ?? 'Gagal menyimpan sandi.')
        return
      }
      window.location.hash = '#/'
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
      <Kartu>
        <h1 className="text-lg font-semibold text-ink">Buat sandi akunmu</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tautan undangan hanya bisa dipakai sekali. Setelah sandi dibuat, kamu bisa masuk kapan saja
          memakai email dan sandi tersebut.
        </p>

        <form className="mt-4 space-y-3" onSubmit={kirim}>
          <Kolom label="Sandi baru" wajib petunjuk="Minimal 6 karakter.">
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

          <Tombol type="submit" penuh disabled={sibuk}>
            {sibuk ? 'Menyimpan…' : 'Simpan sandi & lanjut'}
          </Tombol>
        </form>
      </Kartu>

      <p className="text-center text-xs text-ink-muted">
        Tautan kedaluwarsa? Minta pemilik/admin klub mengirim undangan baru.
      </p>
    </div>
  )
}
