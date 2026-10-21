import type { ReactNode } from 'react'
import { useApp } from '../state/AppContext'
import { cls } from '../lib/utils'
import { keHash, type NamaHalaman } from '../lib/router'
import { Lencana } from './ui'

interface ItemMenu {
  halaman: NamaHalaman
  label: string
  jalur: string
}

const MENU: ItemMenu[] = [
  {
    halaman: 'beranda',
    label: 'Klub',
    jalur: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z',
  },
  {
    halaman: 'anggota',
    label: 'Anggota',
    jalur: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4Z',
  },
  {
    halaman: 'turnamen',
    label: 'Turnamen',
    jalur:
      'M7 3h10v2h3v3a5 5 0 0 1-5 5h-.6A6 6 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A6 6 0 0 1 9.6 13H9a5 5 0 0 1-5-5V5h3V3Zm0 4H6v1a3 3 0 0 0 1 2.2V7Zm11 0v3.2A3 3 0 0 0 19 8V7h-1Z',
  },
  {
    halaman: 'leaderboard',
    label: 'Peringkat',
    jalur: 'M4 20h4v-8H4v8Zm6 0h4V4h-4v16Zm6 0h4v-11h-4v11Z',
  },
]

/** Label bagian yang tampil di bilah atas, mengikuti gaya aplikasi rujukan. */
const BAGIAN: Record<NamaHalaman, string> = {
  'pilih-klub': 'Klub',
  beranda: 'Klub',
  anggota: 'Anggota',
  turnamen: 'Turnamen',
  detail: 'Turnamen',
  leaderboard: 'Peringkat',
  penyimpanan: 'Penyimpanan',
}

function aktifUntuk(halaman: NamaHalaman, ini: NamaHalaman): boolean {
  if (halaman === ini) return true
  if (halaman === 'detail' && ini === 'turnamen') return true
  return false
}

export function Layout({
  halaman,
  klubId,
  children,
}: {
  halaman: NamaHalaman
  klubId?: string
  children: ReactNode
}) {
  const { info, klubAktif, galatMuat } = useApp()
  const didalamKlub = Boolean(klubId)
  const tampilkanRemah = didalamKlub && Boolean(klubId) && Boolean(klubAktif) && halaman !== 'beranda'

  return (
    <div className="min-h-full pb-24 sm:pb-8">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg">
              🏓
            </span>
            <span className="truncate text-base font-bold tracking-tight text-ink">
              Pingpong Club Manager
            </span>
            <span className="ml-2 hidden shrink-0 text-sm text-ink-muted sm:block">
              {BAGIAN[halaman]}
            </span>
          </div>

          <a href={keHash({ halaman: 'penyimpanan' })} className="shrink-0">
            <Lencana warna={info.mode === 'supabase' ? 'hijau' : 'kuning'}>
              {info.mode === 'supabase' ? '● Online' : '● Lokal'}
            </Lencana>
          </a>
        </div>
      </header>

      {(galatMuat || info.mode === 'local') && (
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <div
            className={cls(
              'rounded-2xl border p-3 text-sm',
              galatMuat
                ? 'border-rose-600/40 bg-rose-500/10 text-rose-700'
                : 'border-accent-500/30 bg-accent-500/10 text-accent-900',
            )}
          >
            {galatMuat ? (
              <>
                <p className="font-semibold">Gagal memuat data dari Supabase</p>
                <p className="mt-1 text-rose-700/90">{galatMuat}</p>
                <p className="mt-1 text-xs text-rose-700/80">
                  Data yang kamu lihat berasal dari sesi ini saja. Periksa koneksi/kunci, lalu muat ulang.{' '}
                  <a href={keHash({ halaman: 'penyimpanan' })} className="underline">
                    Lihat panduan integrasi
                  </a>
                  .
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">{info.judul}</p>
                <p className="mt-1">{info.keterangan}</p>
                {info.peringatan && <p className="mt-1 text-xs">{info.peringatan}</p>}
                <a href={keHash({ halaman: 'penyimpanan' })} className="mt-2 inline-block underline">
                  Cara menyambungkan Supabase →
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {tampilkanRemah && klubId && klubAktif && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <a
            href={keHash({ halaman: 'beranda', klubId })}
            className="inline-flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            {klubAktif.name}
          </a>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>

      {didalamKlub && klubId && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-md">
            {MENU.map((m) => {
              const aktif = aktifUntuk(halaman, m.halaman)
              return (
                <a
                  key={m.halaman}
                  href={keHash({ halaman: m.halaman, klubId })}
                  className={cls(
                    'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                    aktif ? 'text-brand-800' : 'text-ink-muted',
                  )}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
                    <path d={m.jalur} />
                  </svg>
                  {m.label}
                </a>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
