import { describe, expect, it } from 'vitest'
import {
  buatJadwalLiga,
  hitungKlasemenLiga,
  juaraLiga,
  kunciTim,
  ligaSelesai,
  rondePenuhLiga,
  validasiSkorLiga,
} from '../liga'
import type { LeagueMatch, Participant } from '../types'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`)

function peserta(tim: string[][]): Participant[] {
  return tim.map((anggota, i) => ({
    id: `pt${i + 1}`,
    tournament_id: 'lg1',
    label: `Peserta ${i + 1}`,
    member_ids: anggota,
  }))
}

function match(
  roundNo: number,
  teamA: string[],
  teamB: string[],
  scoreA: number | null,
  scoreB: number | null,
): LeagueMatch {
  return {
    id: `m${roundNo}-${teamA.join('')}-${teamB.join('')}`,
    tournament_id: 'lg1',
    round_id: `r${roundNo}`,
    round_no: roundNo,
    court_no: 1,
    team_a: teamA,
    team_b: teamB,
    score_a: scoreA,
    score_b: scoreB,
  }
}

describe('jadwal liga round-robin', () => {
  it('4 peserta: 3 ronde, setiap pasangan bertemu tepat sekali, tidak ada yang istirahat', () => {
    const plans = buatJadwalLiga(ids(4))
    expect(plans).toHaveLength(rondePenuhLiga(4))
    expect(plans).toHaveLength(3)

    const pertemuan = new Map<string, number>()
    for (const r of plans) {
      expect(r.courts).toHaveLength(2)
      expect(r.resting).toHaveLength(0)
      const main = r.courts.flatMap((c) => [...c.teamA, ...c.teamB])
      expect(new Set(main).size).toBe(4)
      for (const c of r.courts) {
        expect(c.teamA[0]).not.toBe(c.teamB[0]) // tidak melawan diri sendiri
        const kunci = [c.teamA[0], c.teamB[0]].sort().join('|')
        pertemuan.set(kunci, (pertemuan.get(kunci) ?? 0) + 1)
      }
    }
    expect(pertemuan.size).toBe(6) // C(4,2)
    expect([...pertemuan.values()].every((v) => v === 1)).toBe(true)
  })

  it('5 peserta (ganjil): istirahat bergiliran adil dan semua pasangan bertemu sekali', () => {
    const plans = buatJadwalLiga(ids(5))
    expect(plans).toHaveLength(5)

    const istirahat = new Map<string, number>()
    const pertemuan = new Map<string, number>()
    for (const r of plans) {
      expect(r.courts).toHaveLength(2)
      expect(r.resting).toHaveLength(1)
      istirahat.set(r.resting[0], (istirahat.get(r.resting[0]) ?? 0) + 1)
      for (const c of r.courts) {
        pertemuan.set(
          [c.teamA[0], c.teamB[0]].sort().join('|'),
          (pertemuan.get([c.teamA[0], c.teamB[0]].sort().join('|')) ?? 0) + 1,
        )
      }
    }
    expect([...istirahat.values()]).toEqual([1, 1, 1, 1, 1])
    expect(pertemuan.size).toBe(10) // C(5,2)
    expect([...pertemuan.values()].every((v) => v === 1)).toBe(true)
  })

  it('batas jumlah ronde memotong jadwal tanpa mengulang lawan', () => {
    const plans = buatJadwalLiga(ids(6), 2)
    expect(plans).toHaveLength(2)
    const lawan = new Set<string>()
    for (const r of plans) {
      expect(r.courts).toHaveLength(3)
      for (const c of r.courts) {
        const kunci = [c.teamA[0], c.teamB[0]].sort().join('|')
        expect(lawan.has(kunci)).toBe(false)
        lawan.add(kunci)
      }
    }
  })
})

describe('validasi skor liga (sampai 11 poin per pertandingan)', () => {
  it('menerima skor sah', () => {
    expect(validasiSkorLiga(11, 9, 11).ok).toBe(true)
    expect(validasiSkorLiga(9, 11, 11).ok).toBe(true)
    expect(validasiSkorLiga(11, 10, 11).ok).toBe(true)
    expect(validasiSkorLiga(11, 0, 11).ok).toBe(true)
  })

  it('menolak skor lebih dari 11, deuce, seri, dan negatif', () => {
    expect(validasiSkorLiga(12, 10, 11).ok).toBe(false) // melewati batas 11
    expect(validasiSkorLiga(13, 11, 11).ok).toBe(false)
    expect(validasiSkorLiga(21, 15, 11).ok).toBe(false) // target lain tidak dipakai lagi
    expect(validasiSkorLiga(9, 7, 11).ok).toBe(false) // pemenang belum 11
    expect(validasiSkorLiga(11, 11, 11).ok).toBe(false) // seri
    expect(validasiSkorLiga(-1, 11, 11).ok).toBe(false)
  })
})

describe('klasemen liga', () => {
  const tim = peserta([['a'], ['b'], ['c'], ['d']])

  it('poin dari skor tim, kedua anggota pasangan mendapat nilai sama', () => {
    const pasangan = peserta([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const ms = [match(1, ['a', 'b'], ['c', 'd'], 21, 15)]
    const k = hitungKlasemenLiga(pasangan, ms)
    expect(k.utama).toHaveLength(2)
    expect(k.utama[0].totalPoin).toBe(21)
    expect(k.utama[0].menang).toBe(1)
    expect(k.utama[1].totalPoin).toBe(15)
    expect(k.utama[1].kalah).toBe(1)

    // ringkasan pemain: semua anggota dapat poin timnya, tanpa menambah poin klasemen pasangan
    const a = k.pemain.find((p) => p.kunci === 'a')!
    const b = k.pemain.find((p) => p.kunci === 'b')!
    expect(a.totalPoin).toBe(21)
    expect(b.totalPoin).toBe(21)
    expect(k.pemain.find((p) => p.kunci === 'c')!.totalPoin).toBe(15)
    const totalUtama = k.utama.reduce((s, x) => s + x.totalPoin, 0)
    expect(totalUtama).toBe(36) // 21 + 15, tidak digandakan
  })

  it('mengedit skor menghitung ulang, bukan menambah poin dua kali', () => {
    const ms = [match(1, ['a'], ['b'], 21, 15)]
    const k1 = hitungKlasemenLiga(tim, ms)
    expect(k1.utama.find((x) => x.kunci === kunciTim(['a']))!.totalPoin).toBe(21)

    // skor diubah: hitung dari data tersimpan, bukan akumulasi
    const msEdit = [match(1, ['a'], ['b'], 21, 19)]
    const k2 = hitungKlasemenLiga(tim, msEdit)
    expect(k2.utama.find((x) => x.kunci === kunciTim(['a']))!.totalPoin).toBe(21)
    expect(k2.utama.find((x) => x.kunci === kunciTim(['b']))!.totalPoin).toBe(19)
    expect(k2.utama.find((x) => x.kunci === kunciTim(['b']))!.kalah).toBe(1)

    // skor dikosongkan (dibatalkan): tidak dihitung sama sekali
    const msBatal = [match(1, ['a'], ['b'], null, null)]
    const k3 = hitungKlasemenLiga(tim, msBatal)
    expect(k3.utama.every((x) => x.totalPoin === 0 && x.main === 0)).toBe(true)
    expect(juaraLiga(k3.utama)).toHaveLength(0)
  })

  it('urut total poin, lalu rata-rata, lalu kemenangan', () => {
    const ms = [
      match(1, ['a'], ['b'], 21, 10),
      match(2, ['a'], ['c'], 21, 19),
      match(3, ['b'], ['c'], 21, 5),
    ]
    const k = hitungKlasemenLiga(tim, ms)
    // a: 42 poin (2 main, avg 21) ; b: 31 (2 main, avg 15.5) ; c: 24 (2 main, avg 12) ; d belum main
    expect(k.utama.map((x) => x.kunci).slice(0, 3)).toEqual([
      kunciTim(['a']),
      kunciTim(['b']),
      kunciTim(['c']),
    ])
    expect(k.utama[0].totalPoin).toBe(42)
    expect(k.utama[0].rataRata).toBe(21)
    expect(k.utama[0].peringkat).toBe(1)

    const msSeri = [match(1, ['a'], ['b'], 21, 10), match(2, ['c'], ['d'], 21, 10)]
    const k2 = hitungKlasemenLiga(tim, msSeri)
    expect(k2.utama.filter((x) => x.peringkat === 1)).toHaveLength(2)
  })

  it('liga dianggap selesai hanya kalau semua pertandingan berskor', () => {
    expect(ligaSelesai([match(1, ['a'], ['b'], 21, 10)])).toBe(true)
    expect(ligaSelesai([match(1, ['a'], ['b'], 21, 10), match(2, ['c'], ['d'], null, null)])).toBe(
      false,
    )
    expect(ligaSelesai([])).toBe(false)
  })
})
