import { useState, type ReactNode } from 'react'
import { Kartu, Tombol } from './ui'
import { keHash } from '../lib/router'
import { cls } from '../lib/utils'
import type { TournamentStatus } from '../lib/types'

/** Simpan status "sudah ditutup" untuk petunjuk agar tidak muncul lagi. */
function kunciPetunjuk(id: string) {
  return `pcm.tip.${id}`
}

function sudahDitutup(id: string): boolean {
  try {
    return localStorage.getItem(kunciPetunjuk(id)) === '1'
  } catch {
    return false
  }
}

/** Petunjuk singkat yang bisa ditutup (disimpan di browser). */
export function Petunjuk({
  id,
  judul,
  children,
}: {
  id: string
  judul: string
  children: ReactNode
}) {
  const [tampil, setTampil] = useState(() => !sudahDitutup(id))
  if (!tampil) return null
  return (
    <div className="rounded-2xl border border-brand-600/30 bg-brand-500/10 p-3.5 text-sm text-brand-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">💡 {judul}</p>
          <div className="mt-1 space-y-1 text-brand-800/90">{children}</div>
        </div>
        <button
          type="button"
          aria-label="Tutup petunjuk"
          className="shrink-0 rounded-lg px-2 py-1 text-brand-800/70 hover:bg-ink/10 hover:text-ink"
          onClick={() => {
            try {
              localStorage.setItem(kunciPetunjuk(id), '1')
            } catch {
              /* preferensi UI saja */
            }
            setTampil(false)
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/** Penunjuk langkah berikutnya yang harus dilakukan pengguna. */
export function LangkahBerikutnya({
  judul = 'Langkah berikutnya',
  isi,
  teksTombol,
  tautan,
  onKlik,
}: {
  judul?: string
  isi: ReactNode
  teksTombol?: string
  tautan?: string
  onKlik?: () => void
}) {
  return (
    <Kartu className="border-emerald-600/30 bg-emerald-500/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/90">{judul}</p>
      <div className="mt-1 text-sm text-emerald-800">{isi}</div>
      {(teksTombol || onKlik) && (
        <div className="mt-3">
          {tautan ? (
            <a href={tautan}>
              <Tombol variasi="sukses">{teksTombol ?? 'Lanjut'}</Tombol>
            </a>
          ) : (
            <Tombol variasi="sukses" onClick={onKlik}>
              {teksTombol ?? 'Lanjut'}
            </Tombol>
          )}
        </div>
      )}
    </Kartu>
  )
}

function Langkah({
  nomor,
  judul,
  keterangan,
  selesai,
  aktif,
  tautan,
  teksTombol,
}: {
  nomor: number
  judul: string
  keterangan: string
  selesai: boolean
  aktif: boolean
  tautan: string
  teksTombol: string
}) {
  return (
    <li
      className={cls(
        'flex items-start gap-3 rounded-2xl border p-3.5',
        selesai
          ? 'border-emerald-600/30 bg-emerald-500/10'
          : aktif
            ? 'border-brand-600/40 bg-brand-500/10'
            : 'border-ink/12 bg-ink/6 opacity-70',
      )}
    >
      <span
        className={cls(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          selesai ? 'bg-emerald-500/30 text-emerald-800' : 'bg-ink/10 text-ink-soft',
        )}
      >
        {selesai ? '✓' : nomor}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{judul}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{keterangan}</p>
        {!selesai && aktif && (
          <a href={tautan} className="mt-2 inline-block">
            <Tombol kecil>{teksTombol}</Tombol>
          </a>
        )}
        {!selesai && !aktif && (
          <p className="mt-2 text-xs text-ink-muted">Selesaikan langkah sebelumnya dulu.</p>
        )}
      </div>
    </li>
  )
}

/** Panduan 3 langkah untuk pengguna baru (tampil sampai semuanya selesai). */
export function MulaiDariSini({
  jumlahKlub,
  jumlahAnggota,
  jumlahTurnamen,
  klubId,
}: {
  jumlahKlub: number
  jumlahAnggota: number
  jumlahTurnamen: number
  klubId?: string
}) {
  const langkah1 = jumlahKlub > 0
  const langkah2 = jumlahAnggota >= 2
  const langkah3 = jumlahTurnamen > 0
  const selesai = [langkah1, langkah2, langkah3].filter(Boolean).length

  if (selesai === 3) return null

  return (
    <Kartu className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink">Mulai dari sini</h2>
          <p className="text-sm text-ink-muted">
            Tiga langkah supaya klub bisa dipakai turnamen. Progres {selesai} dari 3.
          </p>
        </div>
        <span className="rounded-full bg-ink/10 px-3 py-1 text-xs text-ink-soft">
          {selesai}/3 selesai
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${(selesai / 3) * 100}%` }}
        />
      </div>

      <ul className="space-y-2">
        <Langkah
          nomor={1}
          judul="Buat klub"
          keterangan="Klub adalah wadah tertinggi: anggota, turnamen, dan leaderboard ada di dalamnya."
          selesai={langkah1}
          aktif={!klubId}
          tautan={keHash({ halaman: 'pilih-klub', aksi: 'baru-klub' })}
          teksTombol="Buat klub sekarang"
        />
        <Langkah
          nomor={2}
          judul="Tambahkan anggota"
          keterangan="Minimal 2 orang; untuk Americano/Liga sebaiknya 4 orang atau lebih."
          selesai={langkah2}
          aktif={langkah1 && Boolean(klubId)}
          tautan={keHash({ halaman: 'anggota', klubId, aksi: 'baru-anggota' })}
          teksTombol="Tambah anggota"
        />
        <Langkah
          nomor={3}
          judul="Buat turnamen"
          keterangan="Pilih jenis turnamen, lalu isi skor tiap pertandingan. Juara dihitung otomatis."
          selesai={langkah3}
          aktif={langkah1 && langkah2 && Boolean(klubId)}
          tautan={keHash({ halaman: 'turnamen', klubId, aksi: 'baru-turnamen' })}
          teksTombol="Buat turnamen"
        />
      </ul>

      {!klubId && (
        <p className="text-xs text-ink-muted">
          Masuk ke klub dulu untuk menambah anggota dan membuat turnamen.
        </p>
      )}

      <PenjelasanJenis ringkas />
    </Kartu>
  )
}

/** Penjelasan bahasa awam untuk setiap jenis turnamen. */
export function PenjelasanJenis({ ringkas = false }: { ringkas?: boolean }) {
  const jenis = [
    {
      nama: 'Knockout',
      ikon: '🏆',
      isi: 'Sistem gugur. Kalah sekali langsung keluar. Cocok untuk turnamen cepat satu hari.',
    },
    {
      nama: 'Americano',
      ikon: '🔄',
      isi: 'Pasangan dirotasi tiap ronde, semua orang main banyak, peringkat dihitung dari poin individu.',
    },
    {
      nama: 'Liga',
      ikon: '📅',
      isi: 'Semua peserta saling bertemu, poin dikumpulkan sepanjang liga. Juara = total poin tertinggi.',
      segera: false,
    },
  ]

  return (
    <div className={cls('grid gap-2', ringkas ? 'sm:grid-cols-3' : 'sm:grid-cols-3')}>
      {jenis.map((j) => (
        <div
          key={j.nama}
          className={cls(
            'rounded-xl border p-3',
            j.segera ? 'border-ink/12 bg-ink/[0.04] opacity-70' : 'border-ink/12 bg-ink/6',
          )}
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span>{j.ikon}</span> {j.nama}
            {j.segera && (
              <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-normal text-ink-soft">
                segera
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-soft">{j.isi}</p>
        </div>
      ))}
    </div>
  )
}

/** Label status yang lebih ramah dibaca. */
export function labelStatus(status: TournamentStatus): string {
  if (status === 'draft') return 'Belum dimulai'
  if (status === 'ongoing') return 'Sedang berjalan'
  return 'Selesai'
}
