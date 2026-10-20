import { useApp } from '../state/AppContext'
import {
  bacaKonfigurasiSupabase,
  paksaModeLokal,
  sedangPaksaModeLokal,
} from '../lib/storage'
import { Kartu, Lencana, Tombol } from '../components/ui'
import schemaSql from '../../supabase/schema.sql?raw'

function Langkah({ n, judul, children }: { n: number; judul: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600/25 text-sm font-semibold text-brand-100">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-100">{judul}</p>
        <div className="mt-1 space-y-1 text-sm text-slate-300">{children}</div>
      </div>
    </li>
  )
}

export default function Supabase() {
  const { info, galatMuat, muatUlang, memuat, pesan, snapshot } = useApp()
  const cfg = bacaKonfigurasiSupabase()
  const dipaksa = sedangPaksaModeLokal()

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
      <h1 className="text-lg font-semibold text-slate-100">Status penyimpanan & integrasi Supabase</h1>

      <Kartu className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Lencana warna={info.mode === 'supabase' ? 'hijau' : 'kuning'}>
            {info.mode === 'supabase' ? 'Online · Supabase' : 'Lokal · browser ini'}
          </Lencana>
          <Lencana>{jumlahData} baris data terbaca</Lencana>
          <Lencana warna={cfg.status === 'siap' ? 'hijau' : 'netral'}>Konfigurasi: {cfg.status}</Lencana>
        </div>
        <p className="text-sm text-slate-300">{info.keterangan}</p>
        {cfg.pesan && <p className="text-xs text-slate-400">{cfg.pesan}</p>}
        {galatMuat && (
          <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
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

      <Kartu className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Cara menyambungkan Supabase (gratis)</h2>
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
            <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-slate-200">
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

      <Kartu className="space-y-2 border-amber-400/30 bg-amber-500/5">
        <h2 className="text-sm font-semibold text-amber-100">Catatan keamanan (penting)</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100/90">
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
