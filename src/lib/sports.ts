import type { Game, TournamentType } from './types'

/**
 * Registry cabang olahraga + mesin skor.
 *
 * Prinsip: perilaku tenis meja TIDAK berubah. Semua aturan skor jadi data
 * (`AturanSkor`) dan fungsi murni, sehingga bisa diuji terpisah dan cabang
 * olahraga baru cukup menambah satu entri di `DAFTAR_OLAHRAGA`.
 */

export type SlugOlahraga = 'table_tennis' | 'badminton' | 'padel'

/** Aturan berbasis poin per game (tenis meja, bulu tangkis). */
export interface AturanPoin {
  jenis: 'poin'
  target: number
  /** Selisih minimum untuk menang. 1 = tanpa deuce (tenis meja). */
  selisihMin: number
  /** Batas atas skor (bulu tangkis: 30). Kosong = tidak ada batas. */
  batasMaks?: number
}

/** Aturan berbasis set/game (padel dengan tennis scoring). */
export interface AturanSet {
  jenis: 'set'
  /** Game yang dibutuhkan untuk memenangkan satu set (6). */
  gamePerSet: number
  selisihMin: number
  /** Batas game dalam satu set (7 = tiebreak 7-6). */
  maksGame: number
  tiebreak: boolean
  goldenPoint: boolean
}

/** Americano: hanya total poin per pemain, tidak ada pemenang game. */
export interface AturanAmericano {
  jenis: 'americano'
  target: number
}

export type AturanSkor = AturanPoin | AturanSet | AturanAmericano

export interface ProfilOlahraga {
  slug: SlugOlahraga
  nama: string
  ikon: string
  formatKompetisi: TournamentType[]
  formatPeserta: ('single' | 'double')[]
  aturan: (format: TournamentType) => AturanSkor
  keterangan: string
}

// ------------------------------------------------------------------ aturan baku

export const ATURAN_TENIS_MEJA: AturanPoin = { jenis: 'poin', target: 11, selisihMin: 1 }
export const ATURAN_BULU_TANGKIS: AturanPoin = {
  jenis: 'poin',
  target: 21,
  selisihMin: 2,
  batasMaks: 30,
}
export const ATURAN_PADEL_SET: AturanSet = {
  jenis: 'set',
  gamePerSet: 6,
  selisihMin: 2,
  maksGame: 7,
  tiebreak: true,
  goldenPoint: false,
}
export const ATURAN_PADEL_AMERICANO: AturanAmericano = { jenis: 'americano', target: 16 }

export const DAFTAR_OLAHRAGA: ProfilOlahraga[] = [
  {
    slug: 'table_tennis',
    nama: 'Pingpong',
    ikon: '🏓',
    formatKompetisi: ['knockout', 'liga', 'americano'],
    formatPeserta: ['single', 'double'],
    aturan: () => ATURAN_TENIS_MEJA,
    keterangan: '11 poin per game, tanpa deuce. Knockout, Liga, atau Americano.',
  },
  {
    slug: 'badminton',
    nama: 'Bulu Tangkis',
    ikon: '🏸',
    formatKompetisi: ['knockout', 'liga'],
    formatPeserta: ['single', 'double'],
    aturan: () => ATURAN_BULU_TANGKIS,
    keterangan: '21 poin rally, deuce sampai unggul 2, maksimal 30. Knockout atau Liga.',
  },
  {
    slug: 'padel',
    nama: 'Padel',
    ikon: '🎾',
    formatKompetisi: ['knockout', 'americano'],
    formatPeserta: ['double', 'single'],
    aturan: (format) => (format === 'americano' ? ATURAN_PADEL_AMERICANO : ATURAN_PADEL_SET),
    keterangan:
      'Double sebagai format utama. Tennis scoring (set 6 game, tiebreak) untuk knockout, Americano untuk rotasi pasangan.',
  },
]

export function profilOlahraga(slug?: string | null): ProfilOlahraga {
  return DAFTAR_OLAHRAGA.find((o) => o.slug === slug) ?? DAFTAR_OLAHRAGA[0]
}

export function formatTersedia(slug?: string | null): TournamentType[] {
  return profilOlahraga(slug).formatKompetisi
}

/** Format dinonaktifkan untuk cabang olahraga ini? */
export function formatDidukung(slug: string | null | undefined, format: TournamentType): boolean {
  return formatTersedia(slug).includes(format)
}

// ------------------------------------------------------------------ mesin skor

/** Pemenang satu game/set, atau null kalau belum sah selesai. */
export function pemenangGame(aturan: AturanSkor, a: number, b: number): 'a' | 'b' | null {
  if (aturan.jenis === 'americano') return a === b ? null : a > b ? 'a' : 'b'
  if (aturan.jenis === 'set') {
    const unggul = Math.abs(a - b)
    const tinggi = Math.max(a, b)
    if (tinggi >= aturan.maksGame) {
      return tinggi === aturan.maksGame && unggul >= 1 ? (a > b ? 'a' : 'b') : null
    }
    if (tinggi >= aturan.gamePerSet && unggul >= aturan.selisihMin) return a > b ? 'a' : 'b'
    return null
  }
  // aturan poin
  const tinggi = Math.max(a, b)
  const unggul = a - b
  if (tinggi < aturan.target) return null
  if (aturan.batasMaks && tinggi > aturan.batasMaks) return null
  if (aturan.batasMaks && tinggi === aturan.batasMaks) return a > b ? 'a' : 'b'
  if (tinggi === aturan.target && Math.abs(unggul) >= aturan.selisihMin) return a > b ? 'a' : 'b'
  if (tinggi > aturan.target && Math.abs(unggul) >= aturan.selisihMin) return a > b ? 'a' : 'b'
  return null
}

/** Pesan galat untuk satu game/set; null = sah. */
export function validasiGame(aturan: AturanSkor, a: number, b: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return 'Skor harus bilangan bulat.'
  if (a < 0 || b < 0) return 'Skor tidak boleh negatif.'

  // Set (padel) diperiksa lebih dulu supaya 7-7 dapat pesan yang spesifik.
  if (aturan.jenis === 'set') {
    const tinggi = Math.max(a, b)
    const unggul = Math.abs(a - b)
    if (tinggi > aturan.maksGame) return `Skor game maksimal ${aturan.maksGame}.`
    if (a === aturan.maksGame && b === aturan.maksGame) {
      return `Tidak boleh ${aturan.maksGame}-${aturan.maksGame}.`
    }
    if (tinggi === aturan.maksGame) {
      if (!aturan.tiebreak && Math.min(a, b) >= aturan.gamePerSet) {
        return `Set ${aturan.maksGame}-${aturan.gamePerSet} hanya boleh kalau tiebreak diaktifkan.`
      }
      return null
    }
    if (tinggi >= aturan.gamePerSet && unggul >= aturan.selisihMin) return null
    return `Set belum selesai: butuh ${aturan.gamePerSet} game dengan selisih ${aturan.selisihMin}.`
  }

  if (a === b) return 'Skor tidak boleh seri.'

  if (aturan.jenis === 'americano') {
    if (a > aturan.target || b > aturan.target) return `Skor maksimal ${aturan.target} poin.`
    return null
  }

  const tinggi = Math.max(a, b)
  {
    if (aturan.batasMaks && tinggi > aturan.batasMaks) {
      return `Skor maksimal ${aturan.batasMaks} poin.`
    }
    if (aturan.selisihMin === 1) {
      if (tinggi !== aturan.target) return `Pemenang harus tepat ${aturan.target} poin.`
      return null
    }
    // Dengan deuce: menang harus mencapai target dengan selisih >= 2, atau batas maks.
    if (tinggi >= aturan.target) {
      if (aturan.batasMaks && tinggi === aturan.batasMaks) return null
      if (tinggi - Math.min(a, b) >= aturan.selisihMin) return null
      return `Pada ${aturan.target}-${aturan.target} harus unggul ${aturan.selisihMin} poin` +
        (aturan.batasMaks ? ` (maksimal ${aturan.batasMaks}).` : '.')
    }
    return `Game belum selesai: minimal ${aturan.target} poin.`
  }
}

export function gamesUntukMenang(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1
}

export interface HasilValidasi {
  ok: boolean
  pesan?: string
}

/** Validasi seluruh game dalam satu pertandingan (best of 3/5). */
export function validasiPertandingan(
  aturan: AturanSkor,
  games: Game[],
  bestOf: number,
): HasilValidasi {
  if (!games.length) return { ok: false, pesan: 'Belum ada skor yang diisi.' }
  const butuh = gamesUntukMenang(bestOf)
  if (games.length > bestOf) return { ok: false, pesan: `Maksimal ${bestOf} game.` }

  for (const [i, g] of games.entries()) {
    const salah = validasiGame(aturan, g.a, g.b)
    if (salah) return { ok: false, pesan: `Game ${i + 1}: ${salah}` }
  }

  if (aturan.jenis === 'americano') return { ok: true }

  let a = 0
  let b = 0
  for (const g of games) {
    const p = pemenangGame(aturan, g.a, g.b)
    if (p === 'a') a += 1
    else if (p === 'b') b += 1
  }
  if (a >= butuh || b >= butuh) return { ok: true }
  // Belum ada pemenang: sah hanya kalau masih boleh menambah game.
  if (games.length < bestOf) return { ok: false, pesan: `Pertandingan belum selesai (best of ${bestOf}).` }
  return { ok: false, pesan: 'Tidak ada pemenang setelah semua game diisi.' }
}

/** Pemenang pertandingan berdasarkan game yang sudah diisi. */
export function pemenangPertandingan(
  aturan: AturanSkor,
  games: Game[],
  bestOf: number,
): 'a' | 'b' | null {
  if (aturan.jenis === 'americano') return null
  const butuh = gamesUntukMenang(bestOf)
  let a = 0
  let b = 0
  for (const g of games) {
    const p = pemenangGame(aturan, g.a, g.b)
    if (p === 'a') a += 1
    if (p === 'b') b += 1
  }
  if (a >= butuh) return 'a'
  if (b >= butuh) return 'b'
  return null
}

/** "11-9, 11-7" (poin) atau "6-4, 3-6, 7-6" (set). */
export function ringkasPertandingan(games: Game[]): string {
  return games.map((g) => `${g.a}-${g.b}`).join(', ')
}

// ------------------------------------------------------------------ tenis (padel)

export interface StatusPoinTenis {
  a: string
  b: string
  selesai: boolean
  pemenang: 'a' | 'b' | null
}

/**
 * Skor poin dalam satu game tenis: 0, 15, 30, 40, deuce, advantage.
 * goldenPoint: pada 40-40 poin berikutnya langsung menentukan pemenang game.
 */
export function statusPoinTenis(poinA: number, poinB: number, goldenPoint = false): StatusPoinTenis {
  const nama = ['0', '15', '30', '40']
  const a = Math.max(0, Math.floor(poinA))
  const b = Math.max(0, Math.floor(poinB))

  if (a >= 3 && b >= 3) {
    if (a === b) {
      return goldenPoint
        ? { a: '40', b: '40', selesai: false, pemenang: null }
        : { a: '40', b: '40', selesai: false, pemenang: null }
    }
    const selisih = a - b
    if (selisih >= 2 || goldenPoint) {
      return {
        a: selisih > 0 ? (goldenPoint ? '40' : 'AD') : '40',
        b: selisih > 0 ? '40' : 'AD',
        selesai: true,
        pemenang: selisih > 0 ? 'a' : 'b',
      }
    }
    return {
      a: selisih > 0 ? 'AD' : '40',
      b: selisih > 0 ? '40' : 'AD',
      selesai: false,
      pemenang: null,
    }
  }

  const tinggi = Math.max(a, b)
  if (tinggi >= 4) {
    return {
      a: a > b ? (a - b >= 2 ? '40' : 'AD') : nama[a] ?? '40',
      b: b > a ? (b - a >= 2 ? '40' : 'AD') : nama[b] ?? '40',
      selesai: a - b >= 2 || b - a >= 2,
      pemenang: a - b >= 2 ? 'a' : b - a >= 2 ? 'b' : null,
    }
  }

  return { a: nama[a] ?? '40', b: nama[b] ?? '40', selesai: false, pemenang: null }
}
