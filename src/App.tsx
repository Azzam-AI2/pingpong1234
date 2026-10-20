import { AppProvider, useApp } from './state/AppContext'
import { Layout } from './components/Layout'
import { Kosong, ToastHost } from './components/ui'
import { pakaiRute } from './lib/router'
import { Dashboard } from './pages/Dashboard'
import Klub from './pages/Klub'
import Turnamen from './pages/Turnamen'
import TurnamenDetail from './pages/TurnamenDetail'
import Leaderboard from './pages/Leaderboard'
import Supabase from './pages/Supabase'

function Isi() {
  const [rute, pindah] = pakaiRute()
  const { siap } = useApp()

  if (!siap) {
    return (
      <Layout halaman={rute.halaman}>
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout halaman={rute.halaman}>
      {rute.halaman === 'dashboard' && <Dashboard />}
      {rute.halaman === 'klub' && <Klub />}
      {rute.halaman === 'turnamen' && <Turnamen pindah={pindah} />}
      {rute.halaman === 'detail' &&
        (rute.id ? (
          <TurnamenDetail id={rute.id} pindah={pindah} />
        ) : (
          <Kosong judul="Turnamen tidak dipilih" pesan="Buka daftar turnamen untuk memilih salah satu." />
        ))}
      {rute.halaman === 'leaderboard' && <Leaderboard />}
      {rute.halaman === 'supabase' && <Supabase />}
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
