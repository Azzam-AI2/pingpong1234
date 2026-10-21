import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { cls, inisial } from '../lib/utils'
import { fileKeDataUrl } from '../lib/gambar'
import { useApp } from '../state/AppContext'

/* ------------------------------------------------------------------ tombol */

type VariasiTombol = 'utama' | 'sekunder' | 'bahaya' | 'hantu' | 'sukses'

const gayaTombol: Record<VariasiTombol, string> = {
  utama: 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 shadow-sm shadow-brand-900/40',
  sekunder: 'bg-surface text-ink border border-ink/15 hover:bg-surface-2',
  bahaya: 'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700',
  sukses: 'bg-emerald-600 text-white hover:bg-emerald-500',
  hantu: 'bg-transparent text-ink-soft hover:bg-ink/10',
}

export function Tombol({
  children,
  variasi = 'utama',
  penuh = false,
  kecil = false,
  className,
  ...rest
}: {
  children: ReactNode
  variasi?: VariasiTombol
  penuh?: boolean
  kecil?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cls(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        kecil ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
        penuh && 'w-full',
        gayaTombol[variasi],
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------- form */

export function Kolom({ label, children, petunjuk, wajib }: { label: string; children: ReactNode; petunjuk?: string; wajib?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">
        {label} {wajib && <span className="text-rose-700">*</span>}
      </span>
      {children}
      {petunjuk && <span className="mt-1 block text-xs text-ink-muted">{petunjuk}</span>}
    </label>
  )
}

const gayaInput =
  'w-full rounded-xl border border-ink/15 bg-surface px-3 py-2.5 text-sm text-ink ' +
  'placeholder:text-ink-faint outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cls(gayaInput, props.className)} />
}

export function Pilih(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cls(gayaInput, 'appearance-none bg-surface-2', props.className)}>
      {props.children}
    </select>
  )
}

export function Segmen<T extends string | number>({
  nilai,
  opsi,
  onPilih,
}: {
  nilai: T
  opsi: { nilai: T; label: string }[]
  onPilih: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-ink/12 bg-ink/6 p-1">
      {opsi.map((o) => (
        <button
          key={o.nilai}
          type="button"
          onClick={() => onPilih(o.nilai)}
          className={cls(
            'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            nilai === o.nilai ? 'bg-brand-600 text-white' : 'text-ink-soft hover:bg-ink/10',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function InputGambar({
  nilai,
  onUbah,
  label = 'Gambar',
}: {
  nilai: string | null
  onUbah: (dataUrl: string | null) => void
  label?: string
}) {
  const id = useId()
  const [galat, setGalat] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement | null>(null)

  const pilih = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setGalat(null)
      onUbah(await fileKeDataUrl(file))
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal memuat gambar.')
    }
    if (ref.current) ref.current.value = ''
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">
        {label} <span className="text-xs text-ink-muted">(opsional)</span>
      </span>
      <div className="flex items-center gap-3">
        {nilai ? (
          <img src={nilai} alt="Pratinjau" className="h-14 w-14 rounded-xl object-cover ring-1 ring-ink/20" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-ink/20 text-xs text-ink-faint">
            kosong
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={id}
            className="cursor-pointer rounded-xl border border-ink/12 bg-ink/10 px-3 py-1.5 text-sm text-ink hover:bg-ink/15"
          >
            Pilih gambar
          </label>
          <input ref={ref} id={id} type="file" accept="image/*" className="hidden" onChange={pilih} />
          {nilai && (
            <Tombol variasi="hantu" kecil onClick={() => onUbah(null)}>
              Hapus
            </Tombol>
          )}
        </div>
      </div>
      {galat && <p className="mt-1 text-xs text-rose-700">{galat}</p>}
      <p className="mt-1 text-xs text-ink-faint">Gambar dikecilkan otomatis sebelum disimpan.</p>
    </div>
  )
}

/* ---------------------------------------------------------------- tampilan */

export function Kartu({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cls(
        'rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm shadow-ink/5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Lencana({
  children,
  warna = 'netral',
}: {
  children: ReactNode
  warna?: 'netral' | 'biru' | 'hijau' | 'kuning' | 'merah'
}) {
  const map = {
    netral: 'bg-ink/10 text-ink-soft',
    biru: 'bg-brand-500/20 text-brand-800',
    hijau: 'bg-emerald-500/20 text-emerald-800',
    kuning: 'bg-accent-500/20 text-accent-900',
    merah: 'bg-rose-500/20 text-rose-700',
  } as const
  return (
    <span className={cls('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', map[warna])}>
      {children}
    </span>
  )
}

export function Avatar({ nama, src, ukuran = 40 }: { nama: string; src?: string | null; ukuran?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={nama}
        style={{ width: ukuran, height: ukuran }}
        className="rounded-full object-cover ring-1 ring-ink/20"
      />
    )
  }
  return (
    <div
      style={{ width: ukuran, height: ukuran, fontSize: Math.max(11, ukuran / 3) }}
      className="flex items-center justify-center rounded-full bg-brand-600/30 font-semibold text-brand-800 ring-1 ring-ink/15"
    >
      {inisial(nama)}
    </div>
  )
}

export function Kosong({ judul, pesan, aksi }: { judul: string; pesan: string; aksi?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-ink/[0.04] p-6 text-center">
      <p className="text-sm font-semibold text-ink-soft">{judul}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{pesan}</p>
      {aksi && <div className="mt-4 flex justify-center gap-2">{aksi}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  judul,
  terbuka,
  onTutup,
  children,
  aksi,
}: {
  judul: string
  terbuka: boolean
  onTutup: () => void
  children: ReactNode
  aksi?: ReactNode
}) {
  useEffect(() => {
    if (!terbuka) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onTutup()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [terbuka, onTutup])

  if (!terbuka) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/45" onClick={onTutup} />
      <div className="animate-slide-up relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-ink/10 bg-surface p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">{judul}</h2>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup"
            className="rounded-lg px-2 py-1 text-ink-muted hover:bg-ink/10 hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {aksi && <div className="mt-5 flex flex-wrap justify-end gap-2">{aksi}</div>}
      </div>
    </div>
  )
}

export function Konfirmasi({
  terbuka,
  judul,
  pesan,
  teksYa = 'Ya, lanjutkan',
  bahaya = true,
  onBatal,
  onYa,
}: {
  terbuka: boolean
  judul: string
  pesan: ReactNode
  teksYa?: string
  bahaya?: boolean
  onBatal: () => void
  onYa: () => void
}) {
  return (
    <Modal
      judul={judul}
      terbuka={terbuka}
      onTutup={onBatal}
      aksi={
        <>
          <Tombol variasi="sekunder" onClick={onBatal}>
            Batal
          </Tombol>
          <Tombol variasi={bahaya ? 'bahaya' : 'utama'} onClick={onYa}>
            {teksYa}
          </Tombol>
        </>
      }
    >
      <div className="text-sm text-ink-soft">{pesan}</div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ toast */

export function ToastHost() {
  const { toasts, tutupToast } = useApp()
  if (!toasts.length) return null
  const warna = {
    sukses: 'border-emerald-600/40 bg-emerald-500/15 text-emerald-800',
    error: 'border-rose-600/40 bg-rose-500/15 text-rose-700',
    info: 'border-ink/20 bg-ink/10 text-ink',
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 p-3">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => tutupToast(t.id)}
          className={cls(
            'animate-toast-in pointer-events-auto w-full max-w-md rounded-xl border px-4 py-3 text-left text-sm shadow-lg backdrop-blur',
            warna[t.jenis],
          )}
        >
          {t.pesan}
        </button>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------- confetti */

const WARNA_CONFETTI = ['#338fff', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6']

export function Confetti({ aktif }: { aktif: boolean }) {
  const [tampil, setTampil] = useState(aktif)

  useEffect(() => {
    if (!aktif) {
      setTampil(false)
      return
    }
    setTampil(true)
    const t = window.setTimeout(() => setTampil(false), 5200)
    return () => window.clearTimeout(t)
  }, [aktif])

  if (!tampil) return null

  return (
    <>
      {Array.from({ length: 48 }).map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 100) / 48 + (i % 3)}%`,
            background: WARNA_CONFETTI[i % WARNA_CONFETTI.length],
            animationDuration: `${2.4 + (i % 5) * 0.35}s`,
            animationDelay: `${(i % 8) * 0.12}s`,
          }}
        />
      ))}
    </>
  )
}

export { cls }
