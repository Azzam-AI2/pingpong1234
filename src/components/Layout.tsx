import type { ReactNode } from 'react'
import { useApp } from '../state/AppContext'
import { cls } from '../lib/utils'
import { keHash, type NamaHalaman } from '../lib/router'
import { Lencana } from './ui'
import { keluar } from '../lib/auth'
import { useEmailSesi } from '../lib/useSesi'
import { NAMA_APLIKASI } from '../lib/merek'

interface ItemMenu {
  halaman: NamaHalaman
  label: string
  jalur: string
}

const MENU: ItemMenu[] = [
  {
    halaman: 'beranda',
    label: 'Beranda',
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
  undangan: 'Undangan',
  'atur-sandi': 'Atur sandi',
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
  const { info, galatMuat, muatUlang, memuat } = useApp()
  const email = useEmailSesi()
  const didalamKlub = Boolean(klubId)

  return (
    <div className="min-h-full pb-24 sm:pb-8">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <a href={keHash({ halaman: 'pilih-klub' })} className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg">
              🏓
            </span>
            <span className="truncate text-base font-bold tracking-tight text-ink">
              {NAMA_APLIKASI}
            </span>
            <span className="ml-2 hidden shrink-0 text-sm text-ink-muted sm:block">
              {BAGIAN[halaman]}
            </span>
          </a>

          <div className="flex shrink-0 items-center gap-1.5">
            {email && (
              <a
                href={keHash({ halaman: 'undangan' })}
                className="rounded-lg px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-ink/10"
              >
                Undangan
              </a>
            )}
            <a href={keHash({ halaman: 'penyimpanan' })}>
              <Lencana warna={info.mode === 'supabase' ? 'hijau' : 'kuning'}>
                {info.mode === 'supabase' ? '● Online' : '● Lokal'}
              </Lencana>
            </a>
            {email && (
              <button
                type="button"
                onClick={() => void keluar()}
                title={email}
                className="max-w-[9rem] truncate rounded-lg px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-ink/10"
              >
                Keluar
              </button>
            )}
          </div>
        </div>

        {didalamKlub && klubId && (
          <nav className="mx-auto hidden max-w-5xl gap-1 px-4 pb-2 sm:flex">
            {MENU.map((m) => (
              <a
                key={m.halaman}
                href={keHash({ halaman: m.halaman, klubId })}
                className={cls(
                  'rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
                  aktifUntuk(halaman, m.halaman)
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-soft hover:bg-ink/10',
                )}
              >
                {m.label}
              </a>
            ))}
          </nav>
        )}
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
                  Data yang kamu lihat berasal dari sesi ini saja. Periksa koneksi, lalu coba lagi.{' '}
                  <a href={keHash({ halaman: 'penyimpanan' })} className="underline">
                    Lihat panduan integrasi
                  </a>
                  .
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void muatUlang()}
                    disabled={memuat}
                    className="rounded-lg border border-rose-600/40 bg-surface px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-500/10"
                  >
                    {memuat ? 'Mencoba…' : 'Coba lagi'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-700/80 underline transition-colors hover:text-rose-700"
                  >
                    Muat ulang halaman
                  </button>
                </div>
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
