import type { ReactNode } from 'react'

export type NamaIkon =
  | 'panahKiri'
  | 'pensil'
  | 'sampah'
  | 'salin'
  | 'cari'
  | 'chevron'
  | 'anggota'
  | 'turnamen'
  | 'peringkat'

const JALUR: Record<NamaIkon, ReactNode> = {
  panahKiri: (
    <>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </>
  ),
  pensil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  sampah: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  salin: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  cari: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  anggota: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  turnamen: (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),
  peringkat: (
    <>
      <rect x="3" y="12" width="4.5" height="9" rx="1.2" />
      <rect x="9.75" y="3" width="4.5" height="18" rx="1.2" />
      <rect x="16.5" y="8" width="4.5" height="13" rx="1.2" />
    </>
  ),
}

/** Ikon garis (outline) gaya seragam: 24x24, stroke currentColor. */
export function Ikon({
  nama,
  kelas = 'h-6 w-6',
  tebal = 1.8,
}: {
  nama: NamaIkon
  kelas?: string
  tebal?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={kelas}
      fill="none"
      stroke="currentColor"
      strokeWidth={tebal}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {JALUR[nama]}
    </svg>
  )
}
