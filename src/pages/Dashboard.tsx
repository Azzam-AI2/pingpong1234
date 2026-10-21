import { useMemo } from 'react'
import { useApp } from '../state/AppContext'
import { Avatar, Kartu, Lencana, Tombol } from '../components/ui'
import { MulaiDariSini } from '../components/Panduan'
import { keHash } from '../lib/router'
import { formatTanggal } from '../lib/utils'
import { ringkasDashboard } from '../lib/stats'

function Stat({ label, nilai, warna }: { label: string; nilai: string | number; warna?: string }) {
  return (
    <Kartu className="flex flex-col gap-1">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={`text-2xl font-semibold ${warna ?? 'text-ink'}`}>{nilai}</span>
    </Kartu>
  )
}

/** Beranda klub: ringkasan dan pintasan kerja harian. */
export function Dashboard() {
  const { snapshot, klubAktif } = useApp()
  const klubId = klubAktif?.id

  const data = useMemo(() => {
    if (!klubAktif) return ringkasDashboard([], [], [], [], [], [])
    const anggota = snapshot.members.filter((m) => m.club_id === klubAktif.id)
    const turnamen = snapshot.tournaments.filter((t) => t.club_id === klubAktif.id)
    const idsTurnamen = new Set(turnamen.map((t) => t.id))
    return ringkasDashboard(
      [klubAktif],
      anggota,
      turnamen,
      snapshot.participants.filter((p) => idsTurnamen.has(p.tournament_id)),
      snapshot.knockout_matches.filter((m) => idsTurnamen.has(m.tournament_id)),
      snapshot.americano_matches.filter((m) => idsTurnamen.has(m.tournament_id)),
    )
  }, [snapshot, klubAktif])

  const berjalan = useMemo(() => {
    if (!klubAktif) return []
    return snapshot.tournaments
      .filter((t) => t.club_id === klubAktif.id && t.status !== 'finished')
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3)
      .map((t) => {
        if (t.type === 'knockout') {
          const main = snapshot.knockout_matches.filter(
            (m) => m.tournament_id === t.id && m.participant_a && m.participant_b,
          )
          return { t, total: main.length, terisi: main.filter((m) => m.games.length > 0).length }
        }
        const ms = snapshot.americano_matches.filter((m) => m.tournament_id === t.id)
        return {
          t,
          total: ms.length,
          terisi: ms.filter((m) => m.score_a !== null && m.score_b !== null).length,
        }
      })
  }, [snapshot, klubAktif])

  if (!klubAktif) return null

  return (
    <div className="space-y-5">
      <MulaiDariSini
        klubId={klubId}
        jumlahKlub={snapshot.clubs.length}
        jumlahAnggota={data.jumlahAnggota}
        jumlahTurnamen={data.turnamenAktif + data.turnamenSelesai}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Anggota" nilai={data.jumlahAnggota} />
        <Stat label="Turnamen berjalan" nilai={data.turnamenAktif} warna="text-brand-800" />
        <Stat label="Turnamen selesai" nilai={data.turnamenSelesai} warna="text-emerald-800" />
      </section>

      <section className="flex flex-wrap gap-2">
        <a href={keHash({ halaman: 'turnamen', klubId, aksi: 'baru-turnamen' })}>
          <Tombol>+ Turnamen baru</Tombol>
        </a>
        <a href={keHash({ halaman: 'anggota', klubId, aksi: 'baru-anggota' })}>
          <Tombol variasi="sekunder">+ Anggota</Tombol>
        </a>
        <a href={keHash({ halaman: 'leaderboard', klubId })}>
          <Tombol variasi="sekunder">Leaderboard</Tombol>
        </a>
      </section>

      {berjalan.length > 0 && (
        <Kartu className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-soft">Sedang berjalan</h2>
          <ul className="space-y-2">
            {berjalan.map(({ t, total, terisi }) => (
              <li key={t.id}>
                <a
                  href={keHash({ halaman: 'detail', klubId, id: t.id })}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink/12 bg-ink/[0.04] p-3 hover:bg-ink/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{t.name}</span>
                    <span className="block text-xs text-ink-muted">
                      {t.type === 'knockout' ? 'Knockout' : 'Americano'} · skor {terisi} dari {total}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-brand-800">
                    {total === 0 ? 'atur peserta →' : terisi === total ? 'tandai selesai →' : 'isi skor →'}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Kartu>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <Kartu>
          <h2 className="mb-2 text-sm font-semibold text-ink-soft">Juara terbaru</h2>
          {data.juaraTerbaru ? (
            <div className="animate-pop-in">
              <p className="text-lg font-semibold text-accent-900">🏆 {data.juaraTerbaru.nama}</p>
              <p className="mt-1 text-sm text-ink-soft">{data.juaraTerbaru.turnamen}</p>
              <p className="text-xs text-ink-muted">
                {data.juaraTerbaru.jenis} · {formatTanggal(data.juaraTerbaru.tanggal)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              Belum ada juara. Selesaikan turnamen knockout atau lengkapi skor Americano.
            </p>
          )}
        </Kartu>

        <Kartu>
          <h2 className="mb-2 text-sm font-semibold text-ink-soft">Top pemain</h2>
          {data.topPemain.length ? (
            <ul className="space-y-2">
              {data.topPemain.map((p, i) => (
                <li key={p.nama} className="flex items-center gap-3">
                  <Avatar nama={p.nama} ukuran={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{p.nama}</p>
                    <p className="text-xs text-ink-muted">
                      {p.matches} pertandingan · win rate {p.winrate}%
                    </p>
                  </div>
                  {p.gelar > 0 ? (
                    <Lencana warna="kuning">🏅 {p.gelar} gelar</Lencana>
                  ) : (
                    <span className="text-xs text-ink-faint">#{i + 1}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Belum ada pertandingan yang dimainkan di klub ini.</p>
          )}
        </Kartu>
      </section>
    </div>
  )
}
