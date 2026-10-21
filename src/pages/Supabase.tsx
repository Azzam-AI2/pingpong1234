import { useState } from 'react'
import { useApp } from '../state/AppContext'
import {
  bacaKonfigurasiSupabase,
  bacaOverrideSupabase,
  paksaModeLokal,
  simpanOverrideSupabase,
  sedangPaksaModeLokal,
  validasiKonfigurasi,
} from '../lib/storage'
import { Input, Kartu, Kolom, Lencana, Tombol } from '../components/ui'
import schemaSql from '../../supabase/schema.sql?raw'

function Langkah({ n, judul, children }: { n: number; judul: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600/25 text-sm font-semibold text-brand-800">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{judul}</p>
        <div className="mt-1 space-y-1 text-sm text-ink-soft">{children}</div>
      </div>
    </li>
  )
}

export default function Supabase() {
  const { info, galatMuat, muatUlang, memuat, pesan, snapshot } = useApp()
  const cfg = bacaKonfigurasiSupabase()
  const dipaksa = sedangPaksaModeLokal()
  const override = bacaOverrideSupabase()
  const [url, setUrl] = useState(override?.url ?? '')
  const [anonKey, setAnonKey] = useState(override?.anonKey ?? '')
  const [galatSambung, setGalatSambung] = useState<string | null>(null)

  const hubungkan = () => {
    const cek = validasiKonfigurasi(url, anonKey)
    if (cek.status !== 'siap') {
      setGalatSambung(cek.pesan)
      return
    }
    setGalatSambung(null)
    simpanOverrideSupabase({ url: url.trim(), anonKey: anonKey.trim() })
    paksaModeLokal(false)
    pesan('Konfigurasi disimpan. Memuat ulang data dari Supabase…', 'sukses')
    window.setTimeout(() => window.location.reload(), 600)
  }

  const lepas = () => {
    simpanOverrideSupabase(null)
    setUrl('')
    setAnonKey('')
    setGalatSambung(null)
    pesan('Konfigurasi Supabase di perangkat ini dilepas.', 'info')
    window.setTimeout(() => window.location.reload(), 600)
  }

  const salinSql = async () => {
    try {
      await navigator.clipboard.writeText(schemaSql)
      pesan('SQL schema disalin. Tempel di SQL Editor Supabase.', 'sukses')
    } catch {
      pesan('Browser menolak akses clipboard. Buka file supabase/schema.sql di folder project.', 'error')
    }
  }

  const jumlahData =
    snapshot.clubs.length +
    snapshot.members.length +
    snapshot.tournaments.length +
    snapshot.participants.length +
    snapshot.knockout_matches.length +
    snapshot.americano_matches.length

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">Status penyimpanan & integrasi Supabase</h1>

      <Kartu className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Lencana warna={info.mode === 'supabase' ? 'hijau' : 'kuning'}>
            {info.mode === 'supabase' ? 'Online · Supabase' : 'Lokal · browser ini'}
          </Lencana>
          <Lencana>{jumlahData} baris data terbaca</Lencana>
          <Lencana warna={cfg.status === 'siap' ? 'hijau' : 'netral'}>Konfigurasi: {cfg.status}</Lencana>
        </div>
        <p className="text-sm text-ink-soft">{info.keterangan}</p>
        {cfg.pesan && <p className="text-xs text-ink-muted">{cfg.pesan}</p>}
        {galatMuat && (
          <p className="rounded-xl border border-rose-600/40 bg-rose-500/10 p-3 text-sm text-rose-700">
            Galat koneksi: {galatMuat}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Tombol kecil onClick={() => void muatUlang()} disabled={memuat}>
            {memuat ? 'Memuat…' : 'Muat ulang data'}
          </Tombol>
          {dipaksa ? (
            <Tombol
              kecil
              variasi="sekunder"
              onClick={() => {
                paksaModeLokal(false)
                window.location.reload()
              }}
            >
              Pakai Supabase lagi
            </Tombol>
          ) : (
            <Tombol
              kecil
              variasi="sekunder"
              onClick={() => {
                paksaModeLokal(true)
                window.location.reload()
              }}
            >
              Pakai mode lokal di perangkat ini
            </Tombol>
          )}
        </div>
      </Kartu>

      <Kartu className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-soft">Hubungkan langsung dari sini</h2>
          {override && <Lencana warna="hijau">diisi dari perangkat ini</Lencana>}
        </div>
        <p className="text-sm text-ink-soft">
          Tempel <b>Project URL</b> dan <b>anon public key</b> dari Supabase Dashboard → Project
          Settings → API. Tersimpan di browser ini, jadi tidak perlu build ulang. Kunci{' '}
          <b>service_role</b> akan ditolak.
        </p>
        <Kolom label="Project URL">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxxxxxxxxxx.supabase.co"
            spellCheck={false}
            autoComplete="off"
          />
        </Kolom>
        <Kolom label="Anon public key">
          <Input
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            spellCheck={false}
            autoComplete="off"
          />
        </Kolom>
        {galatSambung && <p className="text-sm text-rose-700">{galatSambung}</p>}
        <div className="flex flex-wrap gap-2">
          <Tombol onClick={hubungkan} disabled={!url.trim() || !anonKey.trim()}>
            Hubungkan
          </Tombol>
          {override && (
            <Tombol variasi="sekunder" onClick={lepas}>
              Lepas konfigurasi perangkat ini
            </Tombol>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          Kalau ingin semua orang yang membuka aplikasi langsung online, isi juga{' '}
          <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> di environment
          variable Vercel (langkah 4 di bawah).
        </p>
      </Kartu>

      <Kartu className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-soft">Cara menyambungkan Supabase (gratis)</h2>
        <ol className="space-y-4">
          <Langkah n={1} judul="Buat project Supabase">
            <p>
              Daftar di supabase.com lalu <b>New project</b>. Pilih region terdekat (mis. Singapore). Simpan
              database password — tidak dipakai aplikasi ini, tapi jangan sampai hilang.
            </p>
          </Langkah>
          <Langkah n={2} judul="Jalankan skema database">
            <p>
              Buka <b>SQL Editor → New query</b>, tempel isi file <code>supabase/schema.sql</code>, lalu{' '}
              <b>Run</b>. Tabel, validasi kolom, dan policy akses akan dibuat.
            </p>
            <Tombol kecil variasi="sekunder" onClick={salinSql}>
              Salin SQL schema
            </Tombol>
          </Langkah>
          <Langkah n={3} judul="Ambil URL dan anon key">
            <p>
              <b>Project Settings → API</b>: salin <b>Project URL</b> dan <b>anon public</b> key.
            </p>
          </Langkah>
          <Langkah n={4} judul="Isi file .env di folder project">
            <pre className="overflow-x-auto rounded-xl border border-ink/12 bg-ink/[0.06] p-3 text-xs text-ink-soft">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
            </pre>
            <p>
              Mulai dari <code>.env.example</code>. Setelah mengubah .env, hentikan lalu jalankan ulang{' '}
              <code>npm run dev</code> (atau build ulang untuk Vercel).
            </p>
          </Langkah>
          <Langkah n={5} judul="Muat ulang aplikasi">
            <p>
              Banner kuning &quot;mode lokal&quot; akan hilang dan berubah jadi <b>Online · Supabase</b> kalau
              koneksi berhasil. Data di browser tidak otomatis pindah — masukkan ulang atau buat data baru di
              mode online.
            </p>
          </Langkah>
        </ol>
      </Kartu>

      <Kartu className="space-y-2 border-accent-500/30 bg-accent-500/5">
        <h2 className="text-sm font-semibold text-accent-900">Catatan keamanan (penting)</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-accent-900/90">
          <li>
            MVP ini <b>tanpa login</b>. Siapa pun yang mengetahui alamat aplikasi bisa membaca dan mengubah data.
            Jangan simpan data sensitif (nomor telepon, alamat, NIK, data keuangan).
          </li>
          <li>
            Hanya <b>anon public key</b> yang boleh dipakai di frontend. Kunci <b>service_role</b> melewati semua
            policy keamanan — aplikasi ini menolak jalan kalau mendeteksi kunci tersebut.
          </li>
          <li>
            Semua input divalidasi di aplikasi dan dibatasi lagi oleh constraint di database, tetapi keduanya
            tidak menggantikan autentikasi. Kalau butuh pengamanan lebih, batasi akses lewat login/RLS lanjutan.
          </li>
        </ul>
      </Kartu>
    </div>
  )
}
