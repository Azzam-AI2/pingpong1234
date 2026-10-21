import { useEffect } from 'react'
import { AppProvider, useApp } from './state/AppContext'
import { Layout } from './components/Layout'
import { Kosong, ToastHost, Tombol } from './components/ui'
import { keHash, pakaiRute } from './lib/router'
import { Dashboard } from './pages/Dashboard'
import PilihKlub from './pages/PilihKlub'
import Anggota from './pages/Anggota'
import Turnamen from './pages/Turnamen'
import TurnamenDetail from './pages/TurnamenDetail'
import Leaderboard from './pages/Leaderboard'
import Supabase from './pages/Supabase'
import Undangan from './pages/Undangan'
import Masuk from './pages/Masuk'
import AturSandi from './pages/AturSandi'
import Daftar from './pages/Daftar'
import { modeOnline } from './lib/auth'
import { useSesi } from './lib/useSesi'

function Isi() {
  const [rute, pindah] = pakaiRute()
  const { siap, snapshot, pilihKlub } = useApp()

  // Klub adalah hierarki tertinggi: klub aktif selalu mengikuti URL.
  useEffect(() => {
    if (rute.klubId) pilihKlub(rute.klubId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rute.klubId])

  // Layar penetapan sandi dari tautan undangan — tidak butuh data klub.
  if (rute.halaman === 'atur-sandi') return <AturSandi />

  if (!siap) {
    return (
      <Layout halaman={rute.halaman} klubId={rute.klubId}>
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-ink/6" />
          <div className="h-40 animate-pulse rounded-2xl bg-ink/6" />
        </div>
      </Layout>
    )
  }

  const klubHilang = Boolean(rute.klubId) && !snapshot.clubs.some((c) => c.id === rute.klubId)

  if (klubHilang) {
    return (
      <Layout halaman="pilih-klub">
        <Kosong
          judul="Klub tidak ditemukan"
          pesan="Klub ini mungkin sudah dihapus. Pilih klub lain dari daftar."
          aksi={
            <a href={keHash({ halaman: 'pilih-klub' })}>
              <Tombol>Kembali ke daftar klub</Tombol>
            </a>
          }
        />
      </Layout>
    )
  }

  return (
    <Layout halaman={rute.halaman} klubId={rute.klubId}>
      {rute.halaman === 'pilih-klub' && <PilihKlub aksi={rute.aksi} pindah={pindah} />}
      {rute.halaman === 'penyimpanan' && <Supabase />}
      {rute.halaman === 'undangan' && <Undangan />}
      {rute.halaman === 'beranda' && <Dashboard pindah={pindah} />}
      {rute.halaman === 'anggota' && <Anggota aksi={rute.aksi} />}
      {rute.halaman === 'turnamen' && <Turnamen pindah={pindah} aksi={rute.aksi} />}
      {rute.halaman === 'detail' &&
        (rute.id ? (
          <TurnamenDetail id={rute.id} pindah={pindah} />
        ) : (
          <Kosong judul="Turnamen tidak dipilih" pesan="Buka daftar turnamen untuk memilih salah satu." />
        ))}
      {rute.halaman === 'leaderboard' && <Leaderboard />}
    </Layout>
  )
}

export default function App() {
  const { sesi, memuat } = useSesi()
  const [ruteApp] = pakaiRute()
  const wajibMasuk = modeOnline()

  // Tunggu sesi diketahui supaya data tidak sempat dimuat sebagai anonim.
  if (wajibMasuk && memuat) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <div className="h-24 w-full animate-pulse rounded-2xl bg-ink/6" />
      </div>
    )
  }

  // Mode lokal (Supabase tidak dikonfigurasi) tetap bisa dipakai tanpa akun.
  if (wajibMasuk && !sesi) {
    return ruteApp.halaman === 'daftar' ? <Daftar /> : <Masuk />
  }

  return (
    <AppProvider key={sesi?.user.id ?? 'lokal'}>
      <Isi />
      <ToastHost />
    </AppProvider>
  )
}
