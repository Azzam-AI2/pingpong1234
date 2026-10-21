import type { Game, LeagueMatch, Participant, Tournament } from './types'
import { shuffle } from './utils'

/** Penanda "istirahat" pada jadwal round-robin (jumlah peserta ganjil). */
export const BYE = '__bye__'

export interface LigaCourt {
  courtNo: number
  teamA: string[]
  teamB: string[]
}

export interface LigaRoundPlan {
  roundNo: number
  courts: LigaCourt[]
  resting: string[]
}

export interface ValidasiSkorLiga {
  ok: boolean
  error?: string
}

/**
 * Validasi skor liga: pemenang harus mencapai target poin dan unggul minimal 2
 * (aturan deuce tenis meja). Skor harus bilangan bulat 0-99 dan tidak boleh seri.
 */
export function validasiSkorLiga(
  skorA: number,
  skorB: number,
  targetPoin: number,
): ValidasiSkorLiga {
  for (const [nama, s] of [
    ['Skor sisi pertama', skorA],
    ['Skor sisi kedua', skorB],
  ] as const) {
    if (!Number.isInteger(s)) return { ok: false, error: `${nama} harus bilangan bulat.` }
    if (s < 0) return { ok: false, error: `${nama} tidak boleh negatif.` }
    if (s > 99) return { ok: false, error: `${nama} maksimal 99.` }
  }
  if (skorA === skorB) return { ok: false, error: 'Skor tidak boleh seri.' }
  const tinggi = Math.max(skorA, skorB)
  const rendah = Math.min(skorA, skorB)
  if (tinggi < targetPoin) {
    return {
      ok: false,
      error: `Belum ada pemenang: minimal ${targetPoin} poin untuk menang (tertinggi ${tinggi}).`,
    }
  }
  if (tinggi - rendah < 2) {
    return {
      ok: false,
      error: `Selisih skor minimal 2 saat melewati ${targetPoin} poin (aturan deuce).`,
    }
  }
  return { ok: true }
}

/**
 * Jadwal liga round-robin dengan metode lingkaran:
 * setiap peserta bertemu peserta lain tepat sekali, dan istirahat dibagi merata
 * saat jumlah peserta ganjil. Urutan awal diacak, sisi kandang/tandang diacak.
 *
 * @param pesertaIds id peserta (individu untuk Single, pasangan untuk Double)
 * @param maksRonde kalau diisi, jadwal dipotong menjadi sejumlah ronde saja
 */
export function buatJadwalLiga(
  pesertaIds: string[],
  maksRonde?: number | null,
  rand: () => number = Math.random,
): LigaRoundPlan[] {
  const n = pesertaIds.length
  if (n < 2) return []

  const urutan = shuffle(pesertaIds.slice(), rand)
  const ganjil = n % 2 === 1
  const daftar = ganjil ? [...urutan, BYE] : [...urutan]
  const jumlah = daftar.length
  const totalRondePenuh = jumlah - 1
  const jumlahRonde =
    maksRonde && maksRonde > 0 ? Math.min(Math.floor(maksRonde), totalRondePenuh) : totalRondePenuh

  const plans: LigaRoundPlan[] = []
  const putaran = [...daftar]

  for (let r = 0; r < jumlahRonde; r++) {
    const courts: LigaCourt[] = []
    const resting: string[] = []

    for (let i = 0; i < jumlah / 2; i++) {
      const kiri = putaran[i]
      const kanan = putaran[jumlah - 1 - i]
      if (kiri === BYE || kanan === BYE) {
        resting.push(kiri === BYE ? kanan : kiri)
        continue
      }
      const tukar = rand() < 0.5
      courts.push({
        courtNo: courts.length + 1,
        teamA: [tukar ? kanan : kiri],
        teamB: [tukar ? kiri : kanan],
      })
    }

    plans.push({ roundNo: r + 1, courts, resting })

    // rotasi metode lingkaran: posisi pertama tetap, sisanya bergeser satu
    const tetap = putaran[0]
    const sisanya = putaran.slice(1)
    const geser = [sisanya[sisanya.length - 1], ...sisanya.slice(0, -1)]
    putaran.length = 0
    putaran.push(tetap, ...geser)
  }

  return plans
}

/** Berapa ronde penuh yang dibutuhkan untuk semua peserta bertemu sekali. */
export function rondePenuhLiga(jumlahPeserta: number): number {
  if (jumlahPeserta < 2) return 0
  return jumlahPeserta % 2 === 0 ? jumlahPeserta - 1 : jumlahPeserta
}

export interface BarisKlasemen {
  kunci: string
  nama: string
  main: number
  totalPoin: number
  menang: number
  kalah: number
  rataRata: number
  peringkat: number
}

export interface KlasemenLiga {
  /** Klasemen utama: pasangan (Double) atau pemain (Single). */
  utama: BarisKlasemen[]
  /** Ringkasan per anggota; hanya untuk tampilan, tidak menambah poin klasemen utama. */
  pemain: BarisKlasemen[]
}

function urutkan(baris: BarisKlasemen[]): BarisKlasemen[] {
  const arr = baris.slice().sort(
    (a, b) =>
      b.totalPoin - a.totalPoin ||
      b.rataRata - a.rataRata ||
      b.menang - a.menang ||
      a.nama.localeCompare(b.nama),
  )
  let prev: BarisKlasemen | null = null
  arr.forEach((s, i) => {
    if (
      prev &&
      prev.totalPoin === s.totalPoin &&
      prev.rataRata === s.rataRata &&
      prev.menang === s.menang
    ) {
      s.peringkat = prev.peringkat
    } else {
      s.peringkat = i + 1
    }
    prev = s
  })
  return arr
}

function kosongBaris(kunci: string, nama: string): BarisKlasemen {
  return { kunci, nama, main: 0, totalPoin: 0, menang: 0, kalah: 0, rataRata: 0, peringkat: 0 }
}

/** Kunci tim: id anggota diurutkan, supaya urutan sisi tidak mempengaruhi pencocokan. */
export function kunciTim(ids: string[]): string {
  return [...ids].sort().join('|')
}

/**
 * Klasemen liga dihitung ulang seluruhnya dari pertandingan yang tersimpan.
 * Pertandingan tanpa skor lengkap tidak dihitung, sehingga mengedit atau
 * mengosongkan skor tidak pernah menggandakan poin.
 *
 * Klasemen utama di level peserta (pasangan untuk Double, pemain untuk Single).
 * Ringkasan pemain bersifat tambahan dan TIDAK menambah poin klasemen utama.
 */
export function hitungKlasemenLiga(
  peserta: Participant[],
  matches: LeagueMatch[],
  namaAnggota: (id: string) => string = (id) => id,
): KlasemenLiga {
  const utama = new Map<string, BarisKlasemen>()
  const perPemain = new Map<string, BarisKlasemen>()

  for (const p of peserta) {
    const kunci = p.member_ids.length ? kunciTim(p.member_ids) : p.id
    utama.set(kunci, kosongBaris(kunci, p.label))
    for (const id of p.member_ids) {
      if (!perPemain.has(id)) perPemain.set(id, kosongBaris(id, namaAnggota(id)))
    }
  }

  for (const m of matches) {
    if (m.score_a === null || m.score_b === null) continue
    const selisih = m.score_a - m.score_b
    const menangA = selisih > 0

    const sisi = [
      { ids: m.team_a, poin: m.score_a, menang: menangA },
      { ids: m.team_b, poin: m.score_b, menang: !menangA },
    ]

    for (const s of sisi) {
      if (!s.ids.length) continue
      const barisUtama = utama.get(kunciTim(s.ids))
      if (barisUtama) {
        barisUtama.main++
        barisUtama.totalPoin += s.poin
        if (s.menang) barisUtama.menang++
        else barisUtama.kalah++
      }
      for (const idAnggota of s.ids) {
        const barisPemain = perPemain.get(idAnggota)
        if (!barisPemain) continue
        barisPemain.main++
        barisPemain.totalPoin += s.poin
        if (s.menang) barisPemain.menang++
        else barisPemain.kalah++
      }
    }
  }

  const finalisasi = (b: BarisKlasemen) => {
    b.rataRata = b.main > 0 ? Math.round((b.totalPoin / b.main) * 100) / 100 : 0
    return b
  }

  return {
    utama: urutkan([...utama.values()].map(finalisasi)),
    pemain: urutkan([...perPemain.values()].map(finalisasi)),
  }
}

/** Juara liga: peringkat 1 klasemen utama (setelah semua pertandingan berskor). */
export function juaraLiga(klasemen: BarisKlasemen[]): BarisKlasemen[] {
  const ikut = klasemen.filter((b) => b.main > 0)
  if (!ikut.length) return []
  const top = ikut[0]
  return ikut.filter(
    (b) =>
      b.totalPoin === top.totalPoin && b.rataRata === top.rataRata && b.menang === top.menang,
  )
}

/** Semua pertandingan liga sudah berskor? */
export function ligaSelesai(matches: LeagueMatch[]): boolean {
  return matches.length > 0 && matches.every((m) => m.score_a !== null && m.score_b !== null)
}

/** Label peserta Double: gabungan nama anggota. */
export function labelPasangan(namaAnggota: (id: string) => string, team: string[]): string {
  return team.map(namaAnggota).join(' & ')
}

/** Apakah pertandingan ini punya lawan (bukan bye/tidak lengkap). */
export function pertandinganLengkap(m: LeagueMatch): boolean {
  return m.team_a.length > 0 && m.team_b.length > 0 && m.team_a[0] !== m.team_b[0]
}

export type { Tournament, Game }
