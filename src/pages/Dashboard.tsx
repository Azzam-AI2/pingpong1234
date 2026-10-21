import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { Konfirmasi } from '../components/ui'
import { Ikon, type NamaIkon } from '../components/Ikon'
import { ModalKlub, type DataKlubForm } from '../components/KlubForm'
import { MulaiDariSini } from '../components/Panduan'
import { keHash, type Target } from '../lib/router'
import { formatTanggalPanjang } from '../lib/utils'

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

/**
 * Halaman klub: header klub (logo, nama, tanggal dibuat, tombol Edit/Hapus),
 * lalu tiga kartu navigasi besar - Anggota, Turnamen, Peringkat.
 */
export function Dashboard({ pindah }: { pindah?: (t: Target) => void }) {
  const { snapshot, klubAktif, hapusKlub } = useApp()
  const klubId = klubAktif?.id
  const [form, setForm] = useState<DataKlubForm | null>(null)
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)

  const hitung = useMemo(() => {
    if (!klubAktif) return { anggota: 0, turnamen: 0 }
    return {
      anggota: snapshot.members.filter((m) => m.club_id === klubAktif.id).length,
      turnamen: snapshot.tournaments.filter((t) => t.club_id === klubAktif.id).length,
    }
  }, [snapshot, klubAktif])

  if (!klubAktif || !klubId) return null
  const klubBaru = hitung.anggota === 0 && hitung.turnamen === 0

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

      {klubBaru && (
        <MulaiDariSini
          klubId={klubId}
          jumlahKlub={snapshot.clubs.length}
          jumlahAnggota={hitung.anggota}
          jumlahTurnamen={hitung.turnamen}
        />
      )}

      <ModalKlub data={form} onTutup={() => setForm(null)} />

      <Konfirmasi
        terbuka={konfirmasiHapus}
        judul="Hapus klub?"
        pesan={
          <>
            Klub <b>{klubAktif.name}</b> akan dihapus bersama <b>{hitung.anggota} anggota</b> dan{' '}
            <b>{hitung.turnamen} turnamen</b> beserta seluruh hasil pertandingannya. Tindakan ini
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
