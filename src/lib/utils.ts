export function uid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // cadangan untuk browser lama (bukan jalur utama)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function cls(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ')
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** '2026-10-20' -> '20 Okt 2026' */
export function formatTanggal(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${BULAN[m - 1]} ${y}`
}

export function todayISO(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Label babak untuk bracket knockout. */
export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semifinal'
  if (fromEnd === 2) return 'Perempat Final'
  if (fromEnd === 3) return 'Babak 16 Besar'
  if (fromEnd === 4) return 'Babak 32 Besar'
  return `Ronde ${round}`
}

export function inisial(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** Validasi nama (klub/anggota/turnamen). */
export function validasiNama(nama: string, maks = 60): string | null {
  const t = nama.trim()
  if (!t) return 'Nama wajib diisi.'
  if (t.length > maks) return `Nama maksimal ${maks} karakter.`
  return null
}

export function bacaAngka(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  if (!/^-?\d+$/.test(t)) return null
  return Number(t)
}

export function persen(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 1000) / 10
}

export function formatAngka(n: number): string {
  return n.toLocaleString('id-ID')
}
