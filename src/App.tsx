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

function Isi() {
  const [rute, pindah] = pakaiRute()
  const { siap, snapshot, pilihKlub } = useApp()

  // Klub adalah hierarki tertinggi: klub aktif selalu mengikuti URL.
  useEffect(() => {
    if (rute.klubId) pilihKlub(rute.klubId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rute.klubId])

  if (!siap) {
    return (
      <Layout halaman={rute.halaman} klubId={rute.klubId}>
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
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
      {rute.halaman === 'beranda' && <Dashboard />}
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
  return (
    <AppProvider>
      <Isi />
      <ToastHost />
    </AppProvider>
  )
}
