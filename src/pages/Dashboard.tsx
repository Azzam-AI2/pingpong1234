import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { Avatar, Kartu, Lencana, Konfirmasi, Tombol } from '../components/ui'
import { Ikon, type NamaIkon } from '../components/Ikon'
import { ModalKlub, type DataKlubForm } from '../components/KlubForm'
import { MulaiDariSini } from '../components/Panduan'
import { keHash, type Target } from '../lib/router'
import { anggotaAktif } from '../lib/anggota'
import { ringkasDashboard } from '../lib/stats'
import { cls, formatTanggal, formatTanggalPanjang } from '../lib/utils'

const JENIS: Record<string, string> = {
  knockout: 'Knockout',
  liga: 'Liga',
  americano: 'Americano',
}

/** Satu kartu navigasi besar: ikon lalu judul lalu keterangan bertanda panah. */
function KartuMenu({
  href,
  ikon,
  judul,
  keterangan,
}: {
  href: string
  ikon: NamaIkon
  judul: string
  keterangan: string
}) {
  return (
    <a
      href={href}
      className="group flex flex-col rounded-2xl border border-ink/12 bg-surface p-5 transition-colors hover:border-brand-600/40 hover:bg-brand-500/[0.04] sm:p-7"
    >
      <span className="text-brand-700">
        <Ikon nama={ikon} />
      </span>
      <span className="mt-5 text-lg font-bold tracking-tight text-ink sm:mt-6 sm:text-xl">
        {judul}
      </span>
      <span className="mt-1.5 text-sm text-ink-muted sm:text-[15px]">{keterangan}</span>
    </a>
  )
}

function Stat({
  label,
  nilai,
  catatan,
  warna,
}: {
  label: string
  nilai: number | string
  catatan?: string
  warna?: string
}) {
  return (
    <div className="rounded-2xl border border-ink/12 bg-surface p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={cls('mt-1 text-2xl font-bold tracking-tight', warna ?? 'text-ink')}>{nilai}</p>
      {catatan && <p className="text-xs text-ink-faint">{catatan}</p>}
    </div>
  )
}

/**
 * Halaman klub: header klub (logo, nama, tanggal dibuat, tombol Edit/Hapus),
 * tiga kartu navigasi besar, lalu dashboard klub (ringkasan, turnamen berjalan,
 * juara terbaru, dan pemain teratas).
 */
export function Dashboard({ pindah }: { pindah?: (t: Target) => void }) {
  const { snapshot, klubAktif, hapusKlub } = useApp()
  const klubId = klubAktif?.id
  const [form, setForm] = useState<DataKlubForm | null>(null)
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)

  const anggotaKlub = useMemo(
    () => snapshot.members.filter((m) => m.club_id === klubAktif?.id),
    [snapshot.members, klubAktif],
  )
  const turnamenKlub = useMemo(
    () => snapshot.tournaments.filter((t) => t.club_id === klubAktif?.id),
    [snapshot.tournaments, klubAktif],
  )

  const data = useMemo(() => {
    const ids = new Set(turnamenKlub.map((t) => t.id))
    return ringkasDashboard(
      klubAktif ? [klubAktif] : [],
      anggotaKlub,
      turnamenKlub,
      snapshot.participants.filter((p) => ids.has(p.tournament_id)),
      snapshot.knockout_matches.filter((m) => ids.has(m.tournament_id)),
      snapshot.americano_matches.filter((m) => ids.has(m.tournament_id)),
      snapshot.league_matches.filter((m) => ids.has(m.tournament_id)),
    )
  }, [snapshot, klubAktif, anggotaKlub, turnamenKlub])

  const berjalan = useMemo(
    () =>
      turnamenKlub
        .filter((t) => t.status !== 'finished')
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 3)
        .map((t) => {
          if (t.type === 'knockout') {
            const ms = snapshot.knockout_matches.filter(
              (m) => m.tournament_id === t.id && m.participant_a && m.participant_b,
            )
            return { t, total: ms.length, terisi: ms.filter((m) => m.games.length > 0).length }
          }
          const ms =
            t.type === 'liga'
              ? snapshot.league_matches.filter((m) => m.tournament_id === t.id)
              : snapshot.americano_matches.filter((m) => m.tournament_id === t.id)
          return {
            t,
            total: ms.length,
            terisi: ms.filter((m) => m.score_a !== null && m.score_b !== null).length,
          }
        }),
    [snapshot, turnamenKlub],
  )

  if (!klubAktif || !klubId) return null
  const jumlahAktif = anggotaKlub.filter(anggotaAktif).length
  const klubBaru = anggotaKlub.length === 0 && turnamenKlub.length === 0

  return (
    <div className="space-y-7 sm:space-y-9">
      <a
        href={keHash({ halaman: 'pilih-klub' })}
        className="inline-flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <Ikon nama="panahKiri" kelas="h-4 w-4" />
        Semua klub
      </a>

      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        {klubAktif.logo_url ? (
          <img
            src={klubAktif.logo_url}
            alt=""
            className="h-20 w-20 shrink-0 rounded-2xl border border-ink/12 bg-surface object-cover sm:h-28 sm:w-28"
          />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-ink/12 bg-surface text-4xl sm:h-28 sm:w-28 sm:text-5xl">
            🏓
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {klubAktif.name}
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted sm:text-base">
            Dibuat {formatTanggalPanjang(klubAktif.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto sm:gap-6">
          <button
            type="button"
            onClick={() =>
              setForm({ id: klubAktif.id, name: klubAktif.name, logo_url: klubAktif.logo_url })
            }
            className="inline-flex items-center gap-2 rounded-[10px] bg-surface-2 px-5 py-3 text-[15px] font-medium text-brand-700 transition-colors hover:bg-brand-500/20"
          >
            <Ikon nama="pensil" kelas="h-[18px] w-[18px]" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setKonfirmasiHapus(true)}
            className="inline-flex items-center gap-2 px-2 py-3 text-[15px] font-medium text-rose-700 transition-colors hover:text-rose-700/80"
          >
            <Ikon nama="sampah" kelas="h-[18px] w-[18px]" />
            Hapus
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        <KartuMenu
          href={keHash({ halaman: 'anggota', klubId })}
          ikon="anggota"
          judul="Anggota"
          keterangan="Kelola direktori pemain →"
        />
        <KartuMenu
          href={keHash({ halaman: 'turnamen', klubId })}
          ikon="turnamen"
          judul="Turnamen"
          keterangan="Knockout, liga & bagan →"
        />
        <KartuMenu
          href={keHash({ halaman: 'leaderboard', klubId })}
          ikon="peringkat"
          judul="Peringkat"
          keterangan="Leaderboard & statistik pemain →"
        />
      </section>

      <section className="space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
            Ringkasan klub
          </h2>
          <div className="flex flex-wrap gap-2">
            <a href={keHash({ halaman: 'turnamen', klubId, aksi: 'baru-turnamen' })}>
              <Tombol kecil>+ Turnamen</Tombol>
            </a>
            <a href={keHash({ halaman: 'anggota', klubId, aksi: 'baru-anggota' })}>
              <Tombol kecil variasi="sekunder">
                + Anggota
              </Tombol>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <Stat
            label="Anggota"
            nilai={anggotaKlub.length}
            catatan={`${jumlahAktif} aktif`}
          />
          <Stat
            label="Turnamen berjalan"
            nilai={data.turnamenAktif}
            warna="text-brand-800"
            catatan={data.turnamenAktif ? 'masih ada skor diisi' : 'tidak ada'}
          />
          <Stat
            label="Turnamen selesai"
            nilai={data.turnamenSelesai}
            warna="text-emerald-800"
            catatan={data.turnamenSelesai ? 'juara sudah ditetapkan' : 'belum ada'}
          />
        </div>

        {berjalan.length > 0 && (
          <Kartu className="space-y-2">
            <h3 className="text-sm font-semibold text-ink-soft">Sedang berjalan</h3>
            <ul className="space-y-2">
              {berjalan.map(({ t, total, terisi }) => (
                <li key={t.id}>
                  <a
                    href={keHash({ halaman: 'detail', klubId, id: t.id })}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink/12 bg-ink/[0.04] p-3 transition-colors hover:bg-ink/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{t.name}</span>
                      <span className="block text-xs text-ink-muted">
                        {JENIS[t.type] ?? t.type} · {formatTanggal(t.date)} · skor {terisi} dari{' '}
                        {total}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-brand-800">
                      {total === 0
                        ? 'atur peserta →'
                        : terisi === total
                          ? 'tandai selesai →'
                          : 'isi skor →'}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Kartu>
        )}

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <Kartu>
            <h3 className="mb-2 text-sm font-semibold text-ink-soft">Juara terbaru</h3>
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
                Belum ada juara. Selesaikan turnamen knockout, lengkapi skor liga, atau selesaikan
                Americano.
              </p>
            )}
          </Kartu>

          <Kartu>
            <h3 className="mb-2 text-sm font-semibold text-ink-soft">Top pemain</h3>
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
              <p className="text-sm text-ink-muted">
                Belum ada pertandingan yang dimainkan di klub ini.
              </p>
            )}
          </Kartu>
        </div>
      </section>

      {klubBaru && (
        <MulaiDariSini
          klubId={klubId}
          jumlahKlub={snapshot.clubs.length}
          jumlahAnggota={anggotaKlub.length}
          jumlahTurnamen={turnamenKlub.length}
        />
      )}

      <ModalKlub data={form} onTutup={() => setForm(null)} />

      <Konfirmasi
        terbuka={konfirmasiHapus}
        judul="Hapus klub?"
        pesan={
          <>
            Klub <b>{klubAktif.name}</b> akan dihapus bersama <b>{anggotaKlub.length} anggota</b> dan{' '}
            <b>{turnamenKlub.length} turnamen</b> beserta seluruh hasil pertandingannya. Tindakan ini
            tidak bisa dibatalkan.
          </>
        }
        teksYa="Hapus klub & datanya"
        onBatal={() => setKonfirmasiHapus(false)}
        onYa={async () => {
          setKonfirmasiHapus(false)
          const ok = await hapusKlub(klubAktif.id)
          if (ok) {
            if (pindah) pindah({ halaman: 'pilih-klub' })
            else window.location.hash = keHash({ halaman: 'pilih-klub' })
          }
        }}
      />
    </div>
  )
}
