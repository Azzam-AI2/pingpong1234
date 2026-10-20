import { useMemo } from 'react'
import { useApp } from '../state/AppContext'
import { Kartu, Kosong, Lencana, Tombol, Avatar } from '../components/ui'
import { keHash } from '../lib/router'
import { formatTanggal } from '../lib/utils'
import { ringkasDashboard } from '../lib/stats'

function Stat({ label, nilai, warna }: { label: string; nilai: string | number; warna?: string }) {
  return (
    <Kartu className="flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-2xl font-semibold ${warna ?? 'text-slate-100'}`}>{nilai}</span>
    </Kartu>
  )
}

export function Dashboard() {
  const { snapshot, klubAktif, pilihKlub } = useApp()

  const data = useMemo(() => {
    if (!klubAktif) {
      return ringkasDashboard(snapshot.clubs, [], [], [], [], [])
    }
    const anggota = snapshot.members.filter((m) => m.club_id === klubAktif.id)
    const turnamen = snapshot.tournaments.filter((t) => t.club_id === klubAktif.id)
    const idsTurnamen = new Set(turnamen.map((t) => t.id))
    return ringkasDashboard(
      snapshot.clubs,
      anggota,
      turnamen,
      snapshot.participants.filter((p) => idsTurnamen.has(p.tournament_id)),
      snapshot.knockout_matches.filter((m) => idsTurnamen.has(m.tournament_id)),
      snapshot.americano_matches.filter((m) => idsTurnamen.has(m.tournament_id)),
    )
  }, [snapshot, klubAktif])

  if (!snapshot.clubs.length) {
    return (
      <div className="space-y-4">
        <Kosong
          judul="Belum ada klub"
          pesan="Mulai dengan membuat klub, lalu tambahkan anggotanya. Turnamen bisa dibuat setelah ada peserta."
          aksi={
            <>
              <a href={keHash('klub')}>
                <Tombol>Buat klub pertama</Tombol>
              </a>
            </>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Klub" nilai={data.jumlahKlub} />
        <Stat label={`Anggota ${klubAktif?.name ?? ''}`} nilai={data.jumlahAnggota} />
        <Stat label="Turnamen aktif" nilai={data.turnamenAktif} warna="text-brand-300" />
        <Stat label="Turnamen selesai" nilai={data.turnamenSelesai} warna="text-emerald-300" />
      </section>

      <section className="flex flex-wrap gap-2">
        <a href={keHash('turnamen')}>
          <Tombol>+ Turnamen baru</Tombol>
        </a>
        <a href={keHash('klub')}>
          <Tombol variasi="sekunder">+ Anggota</Tombol>
        </a>
        <a href={keHash('leaderboard')}>
          <Tombol variasi="sekunder">Lihat leaderboard</Tombol>
        </a>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Kartu>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Juara terbaru</h2>
          {data.juaraTerbaru ? (
            <div className="animate-pop-in">
              <p className="text-lg font-semibold text-amber-200">🏆 {data.juaraTerbaru.nama}</p>
              <p className="mt-1 text-sm text-slate-300">{data.juaraTerbaru.turnamen}</p>
              <p className="text-xs text-slate-400">
                {data.juaraTerbaru.jenis} · {formatTanggal(data.juaraTerbaru.tanggal)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Belum ada juara. Selesaikan turnamen knockout atau lengkapi skor Americano.
            </p>
          )}
        </Kartu>

        <Kartu>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Top pemain</h2>
          {data.topPemain.length ? (
            <ul className="space-y-2">
              {data.topPemain.map((p, i) => (
                <li key={p.nama} className="flex items-center gap-3">
                  <Avatar nama={p.nama} ukuran={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{p.nama}</p>
                    <p className="text-xs text-slate-400">
                      {p.matches} pertandingan · win rate {p.winrate}%
                    </p>
                  </div>
                  {p.gelar > 0 ? (
                    <Lencana warna="kuning">🏅 {p.gelar} gelar</Lencana>
                  ) : (
                    <span className="text-xs text-slate-500">#{i + 1}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Belum ada pertandingan yang dimainkan di klub ini.</p>
          )}
        </Kartu>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Klub</h2>
        <div className="flex flex-wrap gap-2">
          {snapshot.clubs.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pilihKlub(c.id)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-colors ${
                c.id === klubAktif?.id
                  ? 'border-brand-400/50 bg-brand-500/15 text-brand-100'
                  : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              {c.logo_url ? (
                <img src={c.logo_url} alt="" className="h-6 w-6 rounded-lg object-cover" />
              ) : (
                <span className="text-base">🏓</span>
              )}
              {c.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
