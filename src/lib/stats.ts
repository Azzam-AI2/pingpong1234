import type {
  AmericanoMatch,
  KnockoutMatch,
  LeagueMatch,
  Member,
  Participant,
  Tournament,
} from './types'
import { americanoStandings } from './americano'
import { hitungKlasemenLiga, juaraLiga, kunciTim } from './liga'
import { labelBabak, pemenangTurnamen, resolveWinner } from './knockout'
import { roundLabel } from './utils'

export interface RiwayatTurnamen {
  tournamentId: string
  nama: string
  tanggal: string
  jenis: 'Knockout' | 'Americano' | 'Liga'
  pencapaian: 'Juara' | 'Runner-up' | 'Peserta'
  catatan: string
}

export interface StatDisiplin {
  matches: number
  wins: number
  losses: number
  winrate: number
  titles: number
  poin: number
  riwayat: RiwayatTurnamen[]
}

export interface StatAnggota {
  memberId: string
  nama: string
  photo_url: string | null
  gender: Member['gender']
  knockout: StatDisiplin
  americano: StatDisiplin
  liga: StatDisiplin
}

function kosong(): StatDisiplin {
  return { matches: 0, wins: 0, losses: 0, winrate: 0, titles: 0, poin: 0, riwayat: [] }
}

function finalisasi(s: StatDisiplin): StatDisiplin {
  const total = s.wins + s.losses
  s.winrate = total > 0 ? Math.round((s.wins / total) * 1000) / 10 : 0
  s.riwayat.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0))
  return s
}

/**
 * Statistik seluruh anggota sebuah klub, dipisah antara Knockout dan Americano.
 * Poin Americano TIDAK pernah dihitung sebagai kemenangan Knockout.
 */
export function hitungStatistikKlub(
  members: Member[],
  tournaments: Tournament[],
  participants: Participant[],
  knockoutMatches: KnockoutMatch[],
  americanoMatches: AmericanoMatch[],
  leagueMatches: LeagueMatch[] = [],
): StatAnggota[] {
  const pesertaById = new Map(participants.map((p) => [p.id, p]))
  const stat = new Map<string, StatAnggota>()
  for (const m of members) {
    stat.set(m.id, {
      memberId: m.id,
      nama: m.name,
      photo_url: m.photo_url,
      gender: m.gender,
      knockout: kosong(),
      americano: kosong(),
      liga: kosong(),
    })
  }

  // ---------- Knockout ----------
  for (const t of tournaments) {
    if (t.type !== 'knockout') continue
    const matches = knockoutMatches.filter((m) => m.tournament_id === t.id)
    if (!matches.length) continue
    const bestOf = t.best_of ?? 3
    const juara = pemenangTurnamen(matches, bestOf)
    const finalRound = Math.max(...matches.map((m) => m.round))
    const finalMatch = matches.find((m) => m.round === finalRound)
    const runnerUp =
      finalMatch && finalMatch.winner_id
        ? finalMatch.winner_id === finalMatch.participant_a
          ? finalMatch.participant_b
          : finalMatch.participant_a
        : null

    // pertandingan yang benar-benar dimainkan
    for (const m of matches) {
      if (!m.winner_id || !m.games.length) continue
      const pa = m.participant_a ? pesertaById.get(m.participant_a) : undefined
      const pb = m.participant_b ? pesertaById.get(m.participant_b) : undefined
      const menang = m.winner_id === m.participant_a ? pa : pb
      const kalah = m.winner_id === m.participant_a ? pb : pa
      for (const id of menang?.member_ids ?? []) {
        const s = stat.get(id)
        if (!s) continue
        s.knockout.matches++
        s.knockout.wins++
      }
      for (const id of kalah?.member_ids ?? []) {
        const s = stat.get(id)
        if (!s) continue
        s.knockout.matches++
        s.knockout.losses++
      }
    }

    // riwayat: babak terjauh yang dicapai tiap peserta
    const babakTercapai = new Map<string, number>()
    for (const m of matches) {
      for (const p of [m.participant_a, m.participant_b]) {
        if (!p) continue
        babakTercapai.set(p, Math.max(babakTercapai.get(p) ?? 0, m.round))
      }
    }

    for (const p of participants.filter((x) => x.tournament_id === t.id)) {
      const selesai = t.status === 'finished' && juara !== null
      let pencapaian: RiwayatTurnamen['pencapaian'] = 'Peserta'
      let catatan: string
      if (p.id === juara) {
        pencapaian = 'Juara'
        catatan = 'Juara turnamen'
      } else if (p.id === runnerUp && juara) {
        pencapaian = 'Runner-up'
        catatan = 'Kalah di final'
      } else {
        const r = babakTercapai.get(p.id) ?? 0
        if (!selesai) catatan = r > 0 ? `Masih berjalan (${labelBabak(matches, r)})` : 'Belum bertanding'
        else if (r > 0) catatan = `Tereliminasi di ${labelBabak(matches, r)}`
        else catatan = 'Tidak bertanding'
      }
      const sudahMain = p.member_ids.some((id) => (stat.get(id)?.knockout.matches ?? 0) > 0)
      if (!sudahMain && pencapaian === 'Peserta' && !selesai) continue
      for (const id of p.member_ids) {
        const s = stat.get(id)
        if (!s) continue
        if (pencapaian === 'Juara') s.knockout.titles++
        const ada = s.knockout.riwayat.find((r) => r.tournamentId === t.id)
        if (!ada) {
          s.knockout.riwayat.push({
            tournamentId: t.id,
            nama: t.name,
            tanggal: t.date,
            jenis: 'Knockout',
            pencapaian,
            catatan,
          })
        }
      }
    }
  }

  // ---------- Americano ----------
  for (const t of tournaments) {
    if (t.type !== 'americano') continue
    const matches = americanoMatches.filter((m) => m.tournament_id === t.id)
    if (!matches.length) continue
    const pemain = new Set<string>()
    for (const m of matches) {
      for (const id of [...m.team_a, ...m.team_b]) pemain.add(id)
    }
    for (const p of participants.filter((x) => x.tournament_id === t.id)) {
      for (const id of p.member_ids) pemain.add(id)
    }
    const klasemen = americanoStandings([...pemain], matches)
    const juaraIds = new Set(
      klasemen.filter((k) => k.rank === 1 && k.matches > 0).map((k) => k.memberId),
    )

    for (const s of klasemen) {
      const target = stat.get(s.memberId)
      if (!target) continue
      target.americano.matches += s.matches
      target.americano.wins += s.wins
      target.americano.losses += s.losses
      target.americano.poin += s.points
      if (juaraIds.has(s.memberId) && t.status === 'finished') target.americano.titles++
      if (s.matches > 0 || t.status !== 'draft') {
        target.americano.riwayat.push({
          tournamentId: t.id,
          nama: t.name,
          tanggal: t.date,
          jenis: 'Americano',
          pencapaian: juaraIds.has(s.memberId) && t.status === 'finished' ? 'Juara' : 'Peserta',
          catatan:
            t.status === 'finished'
              ? `Peringkat ${s.rank} · ${s.points} poin`
              : `Sementara peringkat ${s.rank} · ${s.points} poin`,
        })
      }
    }
  }

  // ---------- Liga ----------
  for (const t of tournaments) {
    if (t.type !== 'liga') continue
    const matches = leagueMatches.filter((m) => m.tournament_id === t.id)
    if (!matches.length) continue
    const pesertaLiga = participants.filter((x) => x.tournament_id === t.id)
    const klasemen = hitungKlasemenLiga(pesertaLiga, matches, (id) => stat.get(id)?.nama ?? id)
    const juaraKunci = new Set(
      t.status === 'finished' ? juaraLiga(klasemen.utama).map((b) => b.kunci) : [],
    )

    // poin & menang/kalah tiap pemain diambil dari klasemen pemain (bukan pasangan)
    for (const baris of klasemen.pemain) {
      const target = stat.get(baris.kunci)
      if (!target) continue
      target.liga.matches += baris.main
      target.liga.wins += baris.menang
      target.liga.losses += baris.kalah
      target.liga.poin += baris.totalPoin
    }

    for (const p of pesertaLiga) {
      const juara = juaraKunci.has(kunciTim(p.member_ids))
      for (const id of p.member_ids) {
        const target = stat.get(id)
        if (!target) continue
        const baris = klasemen.pemain.find((b) => b.kunci === id)
        if (juara) target.liga.titles++
        if ((baris?.main ?? 0) > 0 || t.status !== 'draft') {
          target.liga.riwayat.push({
            tournamentId: t.id,
            nama: t.name,
            tanggal: t.date,
            jenis: 'Liga',
            pencapaian: juara ? 'Juara' : 'Peserta',
            catatan: `Peringkat ${baris?.peringkat ?? '-'} · ${baris?.totalPoin ?? 0} poin`,
          })
        }
      }
    }
  }

  return [...stat.values()].map((s) => {
    finalisasi(s.knockout)
    finalisasi(s.americano)
    finalisasi(s.liga)
    return s
  })
}

export type UrutStat = 'gelar' | 'winrate' | 'pertandingan' | 'poin'
export type DisiplinStat = 'knockout' | 'americano' | 'liga' | 'gabungan'

/** Jumlah gelar juara: satu disiplin, atau gabungan Knockout+Americano+Liga. */
export function jumlahGelar(s: StatAnggota, disiplin: DisiplinStat = 'gabungan'): number {
  if (disiplin !== 'gabungan') return s[disiplin].titles
  return s.knockout.titles + s.americano.titles + s.liga.titles
}

/** Jumlah pertandingan: satu disiplin, atau gabungan ketiganya. */
export function jumlahPertandingan(s: StatAnggota, disiplin: DisiplinStat = 'gabungan'): number {
  if (disiplin !== 'gabungan') return s[disiplin].matches
  return s.knockout.matches + s.americano.matches + s.liga.matches
}

/** Win rate dari menang/kalah seluruh disiplin (untuk tampilan gabungan). */
export function winrateGabungan(s: StatAnggota): number {
  const menang = s.knockout.wins + s.americano.wins + s.liga.wins
  const kalah = s.knockout.losses + s.americano.losses + s.liga.losses
  const total = menang + kalah
  return total > 0 ? Math.round((menang / total) * 1000) / 10 : 0
}

export function urutkanStatistik(
  rows: StatAnggota[],
  kunci: UrutStat,
  disiplin: DisiplinStat = 'knockout',
): StatAnggota[] {
  const bagian = (s: StatAnggota) => (disiplin === 'gabungan' ? null : s[disiplin])
  const wr = (s: StatAnggota) => bagian(s)?.winrate ?? winrateGabungan(s)
  const menang = (s: StatAnggota) =>
    bagian(s)?.wins ?? s.knockout.wins + s.americano.wins + s.liga.wins
  const poin = (s: StatAnggota) => bagian(s)?.poin ?? s.americano.poin + s.liga.poin

  const arr = rows.slice()
  arr.sort((a, b) => {
    if (kunci === 'gelar') {
      const t = jumlahGelar(b, disiplin) - jumlahGelar(a, disiplin)
      if (t) return t
      return wr(b) - wr(a)
    }
    if (kunci === 'winrate') {
      const t = wr(b) - wr(a)
      if (t) return t
      return menang(b) - menang(a)
    }
    if (kunci === 'pertandingan') {
      return jumlahPertandingan(b, disiplin) - jumlahPertandingan(a, disiplin)
    }
    const t = poin(b) - poin(a)
    if (t) return t
    return menang(b) - menang(a)
  })
  return arr
}

export interface RingkasanDashboard {
  jumlahKlub: number
  jumlahAnggota: number
  turnamenAktif: number
  turnamenSelesai: number
  juaraTerbaru: { nama: string; turnamen: string; tanggal: string; jenis: string } | null
  topPemain: { nama: string; gelar: number; winrate: number; matches: number }[]
}

export function ringkasDashboard(
  clubs: { id: string }[],
  members: Member[],
  tournaments: Tournament[],
  participants: Participant[],
  knockoutMatches: KnockoutMatch[],
  americanoMatches: AmericanoMatch[],
  leagueMatches: LeagueMatch[] = [],
): RingkasanDashboard {
  const selesai = tournaments.filter((t) => t.status === 'finished')
  const juara: { nama: string; turnamen: string; tanggal: string; jenis: string }[] = []
  for (const t of selesai) {
    if (t.type === 'knockout') {
      const matches = knockoutMatches.filter((m) => m.tournament_id === t.id)
      const best = pemenangTurnamen(matches, t.best_of ?? 3)
      const p = participants.find((x) => x.id === best)
      if (p) juara.push({ nama: p.label, turnamen: t.name, tanggal: t.date, jenis: 'Knockout' })
    } else if (t.type === 'liga') {
      const matches = leagueMatches.filter((m) => m.tournament_id === t.id)
      const peserta = participants.filter((x) => x.tournament_id === t.id)
      const top = juaraLiga(hitungKlasemenLiga(peserta, matches).utama)
      if (top.length) {
        juara.push({
          nama: top.map((k) => k.nama).join(' & '),
          turnamen: t.name,
          tanggal: t.date,
          jenis: 'Liga',
        })
      }
    } else {
      const matches = americanoMatches.filter((m) => m.tournament_id === t.id)
      const pemain = new Set<string>()
      for (const m of matches) for (const id of [...m.team_a, ...m.team_b]) pemain.add(id)
      const klasemen = americanoStandings([...pemain], matches)
      const top = klasemen.filter((k) => k.rank === 1 && k.matches > 0)
      if (top.length) {
        const nama = top
          .map((k) => members.find((m) => m.id === k.memberId)?.name ?? '?')
          .join(' & ')
        juara.push({ nama, turnamen: t.name, tanggal: t.date, jenis: 'Americano' })
      }
    }
  }
  juara.sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))

  const stat = hitungStatistikKlub(
    members,
    tournaments,
    participants,
    knockoutMatches,
    americanoMatches,
    leagueMatches,
  )
    .filter(
      (s) => s.knockout.matches > 0 || s.americano.matches > 0 || s.liga.matches > 0,
    )
    .sort(
      (a, b) =>
        jumlahGelar(b) - jumlahGelar(a) ||
        winrateGabungan(b) - winrateGabungan(a) ||
        a.nama.localeCompare(b.nama, 'id'),
    )
    .slice(0, 5)
    .map((s) => ({
      nama: s.nama,
      gelar: jumlahGelar(s),
      winrate: winrateGabungan(s),
      matches: jumlahPertandingan(s),
    }))

  return {
    jumlahKlub: clubs.length,
    jumlahAnggota: members.length,
    turnamenAktif: tournaments.filter((t) => t.status !== 'finished').length,
    turnamenSelesai: selesai.length,
    juaraTerbaru: juara[0] ?? null,
    topPemain: stat,
  }
}

export { roundLabel, resolveWinner }
