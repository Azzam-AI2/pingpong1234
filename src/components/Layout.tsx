import type { ReactNode } from 'react'
import { useApp } from '../state/AppContext'
import { cls } from '../lib/utils'
import { keHash, type NamaHalaman } from '../lib/router'
import { Lencana } from './ui'

const MENU: { halaman: NamaHalaman; label: string; jalur: string }[] = [
  { halaman: 'dashboard', label: 'Dashboard', jalur: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z' },
  { halaman: 'klub', label: 'Klub', jalur: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4Z' },
  { halaman: 'turnamen', label: 'Turnamen', jalur: 'M7 3h10v2h3v3a5 5 0 0 1-5 5h-.6A6 6 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A6 6 0 0 1 9.6 13H9a5 5 0 0 1-5-5V5h3V3Zm0 4H6v1a3 3 0 0 0 1 2.2V7Zm11 0v3.2A3 3 0 0 0 19 8V7h-1Z' },
  { halaman: 'leaderboard', label: 'Leaderboard', jalur: 'M4 20h4v-8H4v8Zm6 0h4V4h-4v16Zm6 0h4v-11h-4v11Z' },
]

function aktifUntuk(halaman: NamaHalaman, ini: NamaHalaman): boolean {
  if (halaman === ini) return true
  if (halaman === 'detail' && ini === 'turnamen') return true
  return false
}

export function Layout({
  halaman,
  children,
}: {
  halaman: NamaHalaman
  children: ReactNode
}) {
  const { info, klubAktif, snapshot, pilihKlub, galatMuat, memuat } = useApp()
  const klubnya = snapshot.clubs.length

  return (
    <div className="min-h-full bg-ink-900 pb-24 sm:pb-8">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <a href={keHash('dashboard')} className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg">🏓</span>
              <span>
                <span className="block text-sm font-semibold leading-tight text-slate-100">Pingpong Club Manager</span>
                <span className="block text-[11px] leading-tight text-slate-400">
                  {memuat ? 'Menyinkronkan data…' : 'MVP klub tenis meja'}
                </span>
              </span>
            </a>
            <div className="flex items-center gap-2">
              <a href={keHash('supabase')}>
                <Lencana warna={info.mode === 'supabase' ? 'hijau' : 'kuning'}>
                  {info.mode === 'supabase' ? '● Online' : '● Lokal'}
                </Lencana>
              </a>
            </div>
          </div>

          {klubnya > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Klub aktif</span>
              <select
                value={klubAktif?.id ?? ''}
                onChange={(e) => pilihKlub(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
              >
                {snapshot.clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <nav className="hidden gap-1 sm:flex">
            {MENU.map((m) => (
              <a
                key={m.halaman}
                href={keHash(m.halaman)}
                className={cls(
                  'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  aktifUntuk(halaman, m.halaman)
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-white/10',
                )}
              >
                {m.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {(galatMuat || info.mode === 'local') && (
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <div
            className={cls(
              'rounded-2xl border p-3 text-sm',
              galatMuat
                ? 'border-rose-400/40 bg-rose-500/10 text-rose-100'
                : 'border-amber-400/30 bg-amber-500/10 text-amber-100',
            )}
          >
            {galatMuat ? (
              <>
                <p className="font-semibold">Gagal memuat data dari Supabase</p>
                <p className="mt-1 text-rose-100/90">{galatMuat}</p>
                <p className="mt-1 text-xs text-rose-100/80">
                  Data yang kamu lihat berasal dari sesi ini saja. Periksa koneksi/kunci, lalu muat ulang.{' '}
                  <a href={keHash('supabase')} className="underline">
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
                <a href={keHash('supabase')} className="mt-2 inline-block underline">
                  Cara menyambungkan Supabase →
                </a>
              </>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-800/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-md">
          {MENU.map((m) => {
            const aktif = aktifUntuk(halaman, m.halaman)
            return (
              <a
                key={m.halaman}
                href={keHash(m.halaman)}
                className={cls(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  aktif ? 'text-brand-300' : 'text-slate-400',
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
    </div>
  )
}
