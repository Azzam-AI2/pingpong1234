import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AmericanoMatch,
  AmericanoRound,
  Club,
  Game,
  Gender,
  KnockoutMatch,
  Member,
  Participant,
  Snapshot,
  Tournament,
  TournamentStatus,
} from '../lib/types'
import { pilihBackend, type Backend, type InfoPenyimpanan, type Op } from '../lib/storage'
import { snapshotKosong, terapkanKeSnapshot } from '../lib/storage/mirror'
import { generateSchedule, suggestRounds } from '../lib/americano'
import {
  buatJadwalLiga as susunJadwalLiga,
  ligaSelesai,
  POIN_MAKS_LIGA,
  rondePenuhLiga,
  validasiSkorLiga,
} from '../lib/liga'
import { drawBracket, pemenangTurnamen, recompute, validateGames } from '../lib/knockout'
import { hitungStatistikKlub, type StatAnggota } from '../lib/stats'
import { uid } from '../lib/utils'

export type JenisToast = 'sukses' | 'error' | 'info'

export interface Toast {
  id: string
  pesan: string
  jenis: JenisToast
}

export interface DataPeserta {
  label: string
  member_ids: string[]
}

export interface PayloadTurnamen {
  id: string
  club_id: string
  name: string
  date: string
  type: Tournament['type']
  format: Tournament['format']
  best_of: Tournament['best_of']
  target_points: Tournament['target_points']
  match_duration_min: number | null
  date_end: string | null
  rounds_planned: number | null
}

interface AppContextValue {
  siap: boolean
  memuat: boolean
  galatMuat: string | null
  info: InfoPenyimpanan
  masalahKonfigurasi: string | null
  snapshot: Snapshot
  klubAktif: Club | null
  klubTerakhir: Club | null
  statistik: StatAnggota[]
  toasts: Toast[]
  sibuk: boolean
  pilihKlub: (id: string | null) => void
  muatUlang: () => Promise<void>
  tutupToast: (id: string) => void
  pesan: (teks: string, jenis?: JenisToast) => void
  simpanKlub: (d: { id?: string; name: string; logo_url: string | null }) => Promise<string | null>
  hapusKlub: (id: string) => Promise<boolean>
  simpanAnggota: (d: {
    id?: string
    club_id: string
    name: string
    photo_url: string | null
    gender: Gender
    aktif?: boolean
  }) => Promise<boolean>
  hapusAnggota: (id: string) => Promise<boolean>
  pemakaianAnggota: (id: string) => Tournament[]
  simpanTurnamen: (d: PayloadTurnamen) => Promise<boolean>
  ubahTurnamen: (id: string, patch: Partial<Tournament>) => Promise<boolean>
  hapusTurnamen: (id: string) => Promise<boolean>
  setStatus: (t: Tournament, status: TournamentStatus) => Promise<boolean>
  mulaiKnockout: (t: Tournament, peserta: DataPeserta[], ulangi?: boolean) => Promise<boolean>
  simpanHasil: (t: Tournament, matchId: string, games: Game[]) => Promise<boolean>
  hapusHasil: (t: Tournament, matchId: string) => Promise<boolean>
  buatJadwalAmericano: (
    t: Tournament,
    memberIds: string[],
    jumlahRonde: number,
    acakUlang?: boolean,
  ) => Promise<boolean>
  buatJadwalLiga: (
    t: Tournament,
    peserta: DataPeserta[],
    jumlahRonde: number | null,
    acakUlang?: boolean,
  ) => Promise<boolean>
  simpanSkorLiga: (
    t: Tournament,
    matchId: string,
    skorA: number | null,
    skorB: number | null,
  ) => Promise<boolean>
  simpanSkorAmericano: (
    t: Tournament,
    matchId: string,
    skorA: number | null,
    skorB: number | null,
  ) => Promise<boolean>
}

const AppContext = createContext<AppContextValue | null>(null)

const KUNCI_KLUB_AKTIF = 'pcm.klub_aktif'

export function AppProvider({ children }: { children: ReactNode }) {
  const [{ backend, info, masalahKonfigurasi }] = useState(() => pilihBackend())
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snapshotKosong())
  const [siap, setSiap] = useState(false)
  const [memuat, setMemuat] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galatMuat, setGalatMuat] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [klubAktifId, setKlubAktifId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KUNCI_KLUB_AKTIF)
    } catch {
      return null
    }
  })

  const backendRef = useRef<Backend>(backend)
  backendRef.current = backend

  const pesan = useCallback((teks: string, jenis: JenisToast = 'info') => {
    const id = uid()
    setToasts((prev) => [...prev, { id, pesan: teks, jenis }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200)
  }, [])

  const tutupToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const muatUlang = useCallback(async () => {
    setMemuat(true)
    try {
      const data = await backendRef.current.loadAll()
      setSnapshot(data)
      setGalatMuat(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setGalatMuat(msg)
    } finally {
      setMemuat(false)
      setSiap(true)
    }
  }, [])

  useEffect(() => {
    void muatUlang()
  }, [muatUlang])

  const pesanRef = useRef(pesan)
  pesanRef.current = pesan

  const jalankan = useCallback(
    async (ops: Op[], sukses: string): Promise<boolean> => {
      if (!ops.length) return true
      setSibuk(true)
      try {
        await backendRef.current.apply(ops)
        setSnapshot((prev) => terapkanKeSnapshot(prev, ops))
        pesanRef.current(sukses, 'sukses')
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        pesanRef.current(`Gagal menyimpan: ${msg}`, 'error')
        try {
          const data = await backendRef.current.loadAll()
          setSnapshot(data)
        } catch {
          /* biarkan; galat utama sudah ditampilkan */
        }
        return false
      } finally {
        setSibuk(false)
      }
    },
    [],
  )

  // ------------------------------------------------------------------ klub
  const klubs = useMemo(
    () => snapshot.clubs.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.clubs],
  )

  const klubAktif = useMemo(() => {
    if (!klubAktifId) return null
    return klubs.find((c) => c.id === klubAktifId) ?? null
  }, [klubs, klubAktifId])

  const pilihKlub = useCallback((id: string | null) => {
    setKlubAktifId(id)
    try {
      if (id) localStorage.setItem(KUNCI_KLUB_AKTIF, id)
      else localStorage.removeItem(KUNCI_KLUB_AKTIF)
    } catch {
      /* preferensi UI saja */
    }
  }, [])

  const klubTerakhir = useMemo(() => {
    if (!klubAktifId) return null
    return klubs.find((c) => c.id === klubAktifId) ?? null
  }, [klubs, klubAktifId])

  const statistik = useMemo(() => {
    if (!klubAktif) return []
    return hitungStatistikKlub(
      snapshot.members.filter((m) => m.club_id === klubAktif.id),
      snapshot.tournaments.filter((t) => t.club_id === klubAktif.id),
      snapshot.participants,
      snapshot.knockout_matches,
      snapshot.americano_matches,
      snapshot.league_matches,
    )
  }, [snapshot, klubAktif])

  // ------------------------------------------------------------------ aksi
  const simpanKlub = useCallback<AppContextValue['simpanKlub']>(
    async (d) => {
      const nama = d.name.trim()
      if (!nama) {
        pesanRef.current('Nama klub wajib diisi.', 'error')
        return null
      }
      if (d.id) {
        const ok = await jalankan(
          [{ table: 'clubs', type: 'update', id: d.id, patch: { name: nama, logo_url: d.logo_url } }],
          'Perubahan klub disimpan.',
        )
        return ok ? d.id : null
      }
      const row: Club = {
        id: uid(),
        name: nama,
        logo_url: d.logo_url,
        created_at: new Date().toISOString(),
      }
      const ok = await jalankan([{ table: 'clubs', type: 'insert', row }], 'Klub ditambahkan.')
      if (ok) pilihKlub(row.id)
      return ok ? row.id : null
    },
    [jalankan, pilihKlub],
  )

  const hapusKlub = useCallback<AppContextValue['hapusKlub']>(
    async (id) => {
      const s = snapshot
      const ops: Op[] = []
      const turnamenIds = new Set(s.tournaments.filter((t) => t.club_id === id).map((t) => t.id))
      for (const m of s.americano_matches)
        if (turnamenIds.has(m.tournament_id)) ops.push({ table: 'americano_matches', type: 'delete', id: m.id })
      for (const r of s.americano_rounds)
        if (turnamenIds.has(r.tournament_id)) ops.push({ table: 'americano_rounds', type: 'delete', id: r.id })
      for (const m of s.knockout_matches)
        if (turnamenIds.has(m.tournament_id)) ops.push({ table: 'knockout_matches', type: 'delete', id: m.id })
      for (const m of s.league_matches)
        if (turnamenIds.has(m.tournament_id))
          ops.push({ table: 'league_matches', type: 'delete', id: m.id })
      for (const r of s.league_rounds)
        if (turnamenIds.has(r.tournament_id))
          ops.push({ table: 'league_rounds', type: 'delete', id: r.id })
      for (const p of s.participants)
        if (turnamenIds.has(p.tournament_id)) ops.push({ table: 'participants', type: 'delete', id: p.id })
      for (const t of s.tournaments)
        if (t.club_id === id) ops.push({ table: 'tournaments', type: 'delete', id: t.id })
      for (const m of s.members)
        if (m.club_id === id) ops.push({ table: 'members', type: 'delete', id: m.id })
      ops.push({ table: 'clubs', type: 'delete', id })
      return jalankan(ops, 'Klub beserta datanya dihapus.')
    },
    [jalankan, snapshot],
  )

  const simpanAnggota = useCallback<AppContextValue['simpanAnggota']>(
    async (d) => {
      const nama = d.name.trim()
      if (!nama) {
        pesanRef.current('Nama anggota wajib diisi.', 'error')
        return false
      }
      if (d.id) {
        return jalankan(
          [
            {
              table: 'members',
              type: 'update',
              id: d.id,
              patch: { name: nama, photo_url: d.photo_url, gender: d.gender, aktif: d.aktif ?? true },
            },
          ],
          'Perubahan anggota disimpan.',
        )
      }
      const row: Member = {
        id: uid(),
        club_id: d.club_id,
        name: nama,
        photo_url: d.photo_url,
        gender: d.gender,
        aktif: d.aktif ?? true,
        created_at: new Date().toISOString(),
      }
      return jalankan([{ table: 'members', type: 'insert', row }], `Anggota ${nama} ditambahkan.`)
    },
    [jalankan],
  )

  const hapusAnggota = useCallback<AppContextValue['hapusAnggota']>(
    async (id) => {
      const ops: Op[] = []
      for (const p of snapshot.participants) {
        if (p.member_ids.includes(id)) {
          ops.push({
            table: 'participants',
            type: 'update',
            id: p.id,
            patch: { member_ids: p.member_ids.filter((x) => x !== id) },
          })
        }
      }
      ops.push({ table: 'members', type: 'delete', id })
      return jalankan(ops, 'Anggota dihapus.')
    },
    [jalankan, snapshot.participants],
  )

  const pemakaianAnggota = useCallback<AppContextValue['pemakaianAnggota']>(
    (id) => {
      const turnamenIds = new Set(
        snapshot.participants.filter((p) => p.member_ids.includes(id)).map((p) => p.tournament_id),
      )
      return snapshot.tournaments.filter((t) => turnamenIds.has(t.id))
    },
    [snapshot.participants, snapshot.tournaments],
  )

  // -------------------------------------------------------------- turnamen
  const simpanTurnamen = useCallback<AppContextValue['simpanTurnamen']>(
    async (d) => {
      const nama = d.name.trim()
      if (!nama) {
        pesanRef.current('Nama turnamen wajib diisi.', 'error')
        return false
      }
      if (!d.date) {
        pesanRef.current('Tanggal turnamen wajib diisi.', 'error')
        return false
      }
      if (d.type === 'knockout' && (!d.format || !d.best_of)) {
        pesanRef.current('Format knockout wajib memilih Single/Double dan Best of 3/5.', 'error')
        return false
      }
      if (d.type === 'americano' && !d.target_points) {
        pesanRef.current('Target poin Americano wajib dipilih.', 'error')
        return false
      }
      const row: Tournament = {
        id: d.id,
        club_id: d.club_id,
        name: nama,
        date: d.date,
        type: d.type,
        format: d.type === 'americano' ? null : d.format,
        best_of: d.type === 'knockout' ? d.best_of : null,
        target_points: d.type === 'knockout' ? null : d.target_points,
        match_duration_min: d.type === 'americano' ? d.match_duration_min : null,
        status: 'draft',
        created_at: new Date().toISOString(),
        date_end: d.date_end,
        rounds_planned: d.rounds_planned,
      }
      return jalankan([{ table: 'tournaments', type: 'insert', row }], `Turnamen "${nama}" dibuat.`)
    },
    [jalankan],
  )

  const ubahTurnamen = useCallback<AppContextValue['ubahTurnamen']>(
    async (id, patch) => jalankan([{ table: 'tournaments', type: 'update', id, patch }], 'Turnamen diperbarui.'),
    [jalankan],
  )

  const hapusTurnamen = useCallback<AppContextValue['hapusTurnamen']>(
    async (id) => {
      const s = snapshot
      const ops: Op[] = []
      for (const m of s.americano_matches)
        if (m.tournament_id === id) ops.push({ table: 'americano_matches', type: 'delete', id: m.id })
      for (const r of s.americano_rounds)
        if (r.tournament_id === id) ops.push({ table: 'americano_rounds', type: 'delete', id: r.id })
      for (const m of s.knockout_matches)
        if (m.tournament_id === id) ops.push({ table: 'knockout_matches', type: 'delete', id: m.id })
      for (const p of s.participants)
        if (p.tournament_id === id) ops.push({ table: 'participants', type: 'delete', id: p.id })
      ops.push({ table: 'tournaments', type: 'delete', id })
      return jalankan(ops, 'Turnamen dihapus.')
    },
    [jalankan, snapshot],
  )

  const setStatus = useCallback<AppContextValue['setStatus']>(
    async (t, status) =>
      jalankan(
        [{ table: 'tournaments', type: 'update', id: t.id, patch: { status } }],
        status === 'finished' ? 'Turnamen ditandai selesai.' : 'Status turnamen diubah.',
      ),
    [jalankan],
  )

  // -------------------------------------------------------------- knockout
  const mulaiKnockout = useCallback<AppContextValue['mulaiKnockout']>(
    async (t, peserta, ulangi = false) => {
      if (peserta.length < 2) {
        pesanRef.current('Minimal 2 peserta untuk mengundi bracket.', 'error')
        return false
      }
      const labels = new Set(peserta.map((p) => p.label.toLowerCase()))
      if (labels.size !== peserta.length) {
        pesanRef.current('Ada peserta dengan nama sama. Ubah dulu agar bracket tidak membingungkan.', 'error')
        return false
      }
      const ops: Op[] = []
      if (ulangi) {
        for (const m of snapshot.knockout_matches)
          if (m.tournament_id === t.id) ops.push({ table: 'knockout_matches', type: 'delete', id: m.id })
        for (const p of snapshot.participants)
          if (p.tournament_id === t.id) ops.push({ table: 'participants', type: 'delete', id: p.id })
      }
      const daftarPeserta: Participant[] = peserta.map((p) => ({
        id: uid(),
        tournament_id: t.id,
        label: p.label,
        member_ids: p.member_ids,
      }))
      for (const p of daftarPeserta) ops.push({ table: 'participants', type: 'insert', row: p })

      const { matches } = drawBracket(
        t.id,
        daftarPeserta.map((p) => p.id),
      )
      // id match dipakai ulang agar aman saat undian ulang: ganti dengan id baru
      const petaId = new Map<string, string>()
      for (const m of matches) petaId.set(m.id, uid())
      const siapUjud = matches.map((m) => ({
        ...m,
        id: petaId.get(m.id)!,
        next_match_id: m.next_match_id ? petaId.get(m.next_match_id)! : null,
      }))
      for (const m of recompute(siapUjud)) ops.push({ table: 'knockout_matches', type: 'insert', row: m })
      ops.push({ table: 'tournaments', type: 'update', id: t.id, patch: { status: 'ongoing' } })
      return jalankan(ops, ulangi ? 'Bracket diundi ulang.' : 'Bracket berhasil diundi.')
    },
    [jalankan, snapshot.knockout_matches, snapshot.participants],
  )

  const simpanHasil = useCallback<AppContextValue['simpanHasil']>(
    async (t, matchId, games) => {
      const bestOf = t.best_of ?? 3
      const cek = validateGames(games, bestOf)
      if (!cek.ok) {
        pesanRef.current(cek.error ?? 'Skor tidak valid.', 'error')
        return false
      }
      const baru = recompute(
        snapshot.knockout_matches.map((m) => (m.id === matchId ? { ...m, games } : m)),
      )
      const ops = diffKnockout(snapshot.knockout_matches, baru, t.id)
      const juara = pemenangTurnamen(baru, bestOf)
      if (juara && t.status !== 'finished') {
        ops.push({ table: 'tournaments', type: 'update', id: t.id, patch: { status: 'finished' } })
      }
      return jalankan(ops, juara ? 'Hasil disimpan — turnamen selesai, juara sudah ditentukan!' : 'Hasil pertandingan disimpan.')
    },
    [jalankan, snapshot.knockout_matches],
  )

  const hapusHasil = useCallback<AppContextValue['hapusHasil']>(
    async (t, matchId) => {
      const baru = recompute(
        snapshot.knockout_matches.map((m) => (m.id === matchId ? { ...m, games: [] } : m)),
      )
      const ops = diffKnockout(snapshot.knockout_matches, baru, t.id)
      if (!pemenangTurnamen(baru, t.best_of ?? 3) && t.status === 'finished') {
        ops.push({ table: 'tournaments', type: 'update', id: t.id, patch: { status: 'ongoing' } })
      }
      return jalankan(ops, 'Skor pertandingan dihapus.')
    },
    [jalankan, snapshot.knockout_matches],
  )

  // ------------------------------------------------------------- americano
  const buatJadwalAmericano = useCallback<AppContextValue['buatJadwalAmericano']>(
    async (t, memberIds, jumlahRonde, acakUlang = false) => {
      if (memberIds.length < 4) {
        pesanRef.current('Americano butuh minimal 4 pemain.', 'error')
        return false
      }
      const jumlah = Math.max(1, Math.min(30, Math.floor(jumlahRonde) || suggestRounds(memberIds.length)))
      const plans = generateSchedule(memberIds, jumlah)
      const ops: Op[] = []
      if (acakUlang) {
        for (const m of snapshot.americano_matches)
          if (m.tournament_id === t.id) ops.push({ table: 'americano_matches', type: 'delete', id: m.id })
        for (const r of snapshot.americano_rounds)
          if (r.tournament_id === t.id) ops.push({ table: 'americano_rounds', type: 'delete', id: r.id })
        for (const p of snapshot.participants)
          if (p.tournament_id === t.id) ops.push({ table: 'participants', type: 'delete', id: p.id })
      }
      const anggotaKlub = snapshot.members
      for (const id of memberIds) {
        const m = anggotaKlub.find((x) => x.id === id)
        ops.push({
          table: 'participants',
          type: 'insert',
          row: {
            id: uid(),
            tournament_id: t.id,
            label: m?.name ?? 'Pemain',
            member_ids: [id],
          },
        })
      }
      for (const plan of plans) {
        const rondeId = uid()
        const ronde: AmericanoRound = { id: rondeId, tournament_id: t.id, round_no: plan.roundNo }
        ops.push({ table: 'americano_rounds', type: 'insert', row: ronde })
        for (const tb of plan.tables) {
          const row: AmericanoMatch = {
            id: uid(),
            tournament_id: t.id,
            round_id: rondeId,
            round_no: plan.roundNo,
            table_no: tb.tableNo,
            team_a: tb.teamA,
            team_b: tb.teamB,
            score_a: null,
            score_b: null,
          }
          ops.push({ table: 'americano_matches', type: 'insert', row })
        }
      }
      ops.push({ table: 'tournaments', type: 'update', id: t.id, patch: { status: 'ongoing' } })
      return jalankan(ops, acakUlang ? 'Jadwal Americano diacak ulang.' : 'Jadwal Americano dibuat.')
    },
    [jalankan, snapshot.americano_matches, snapshot.americano_rounds, snapshot.members, snapshot.participants],
  )

  const simpanSkorAmericano = useCallback<AppContextValue['simpanSkorAmericano']>(
    async (t, matchId, skorA, skorB) => {
      if ((skorA === null) !== (skorB === null)) {
        pesanRef.current('Isi kedua skor, atau kosongkan keduanya.', 'error')
        return false
      }
      for (const s of [skorA, skorB]) {
        if (s !== null && (!Number.isInteger(s) || s < 0 || s > 99)) {
          pesanRef.current('Skor harus bilangan bulat 0-99.', 'error')
          return false
        }
      }
      const ops: Op[] = [
        { table: 'americano_matches', type: 'update', id: matchId, patch: { score_a: skorA, score_b: skorB } },
      ]
      const semua = snapshot.americano_matches
        .filter((m) => m.tournament_id === t.id)
        .map((m) => (m.id === matchId ? { ...m, score_a: skorA, score_b: skorB } : m))
      const lengkap = semua.length > 0 && semua.every((m) => m.score_a !== null && m.score_b !== null)
      if (lengkap && t.status !== 'finished') {
        ops.push({ table: 'tournaments', type: 'update', id: t.id, patch: { status: 'finished' } })
      } else if (!lengkap && t.status === 'finished') {
        ops.push({ table: 'tournaments', type: 'update', id: t.id, patch: { status: 'ongoing' } })
      }
      return jalankan(ops, lengkap ? 'Semua skor lengkap — turnamen Americano selesai!' : 'Skor disimpan.')
    },
    [jalankan, snapshot.americano_matches],
  )

  // ------------------------------------------------------------------ liga
  const buatJadwalLiga = useCallback<AppContextValue['buatJadwalLiga']>(
    async (t, peserta, jumlahRonde, acakUlang = false) => {
      if (peserta.length < 2) {
        pesanRef.current('Minimal 2 peserta untuk membuat jadwal liga.', 'error')
        return false
      }
      if (t.format === 'double') {
        const dipakai = new Set<string>()
        for (const p of peserta) {
          if (p.member_ids.length !== 2) {
            pesanRef.current(`Pasangan "${p.label}" harus berisi tepat 2 anggota.`, 'error')
            return false
          }
          for (const id of p.member_ids) {
            if (dipakai.has(id)) {
              pesanRef.current('Ada anggota yang masuk ke dua pasangan berbeda. Perbaiki dulu.', 'error')
              return false
            }
            dipakai.add(id)
          }
        }
      }
      const penuh = rondePenuhLiga(peserta.length)
      const jumlah = jumlahRonde && jumlahRonde > 0 ? Math.min(jumlahRonde, penuh) : penuh
      const daftar = peserta.map((p) => ({ ...p, id: uid() }))
      const petaAnggota = new Map(daftar.map((p) => [p.id, p.member_ids]))
      const plans = susunJadwalLiga(
        daftar.map((p) => p.id),
        jumlah,
      )

      const ops: Op[] = []
      if (acakUlang) {
        for (const m of snapshot.league_matches)
          if (m.tournament_id === t.id) ops.push({ table: 'league_matches', type: 'delete', id: m.id })
        for (const r of snapshot.league_rounds)
          if (r.tournament_id === t.id) ops.push({ table: 'league_rounds', type: 'delete', id: r.id })
        for (const p of snapshot.participants)
          if (p.tournament_id === t.id) ops.push({ table: 'participants', type: 'delete', id: p.id })
      }

      for (const p of daftar) {
        ops.push({
          table: 'participants',
          type: 'insert',
          row: { id: p.id, tournament_id: t.id, label: p.label, member_ids: p.member_ids },
        })
      }

      for (const plan of plans) {
        const rondeId = uid()
        ops.push({
          table: 'league_rounds',
          type: 'insert',
          row: { id: rondeId, tournament_id: t.id, round_no: plan.roundNo },
        })
        for (const c of plan.courts) {
          ops.push({
            table: 'league_matches',
            type: 'insert',
            row: {
              id: uid(),
              tournament_id: t.id,
              round_id: rondeId,
              round_no: plan.roundNo,
              court_no: c.courtNo,
              team_a: petaAnggota.get(c.teamA[0]) ?? [],
              team_b: petaAnggota.get(c.teamB[0]) ?? [],
              score_a: null,
              score_b: null,
            },
          })
        }
      }

      ops.push({ table: 'tournaments', type: 'update', id: t.id, patch: { status: 'ongoing' } })
      return jalankan(
        ops,
        acakUlang ? 'Jadwal liga dibuat ulang.' : `Jadwal liga dibuat: ${plans.length} ronde.`,
      )
    },
    [jalankan, snapshot.league_matches, snapshot.league_rounds, snapshot.participants],
  )

  const simpanSkorLiga = useCallback<AppContextValue['simpanSkorLiga']>(
    async (t, matchId, skorA, skorB) => {
      if ((skorA === null) !== (skorB === null)) {
        pesanRef.current('Isi kedua skor, atau kosongkan keduanya untuk membatalkan.', 'error')
        return false
      }
      if (skorA !== null && skorB !== null) {
        const cek = validasiSkorLiga(skorA, skorB, t.target_points ?? POIN_MAKS_LIGA)
        if (!cek.ok) {
          pesanRef.current(cek.error ?? 'Skor tidak valid.', 'error')
          return false
        }
      }
      const ops: Op[] = [
        {
          table: 'league_matches',
          type: 'update',
          id: matchId,
          patch: { score_a: skorA, score_b: skorB },
        },
      ]
      const semua = snapshot.league_matches
        .filter((m) => m.tournament_id === t.id)
        .map((m) => (m.id === matchId ? { ...m, score_a: skorA, score_b: skorB } : m))
      if (ligaSelesai(semua) && t.status !== 'finished') {
        ops.push({ table: 'tournaments', type: 'update', id: t.id, patch: { status: 'finished' } })
      } else if (!ligaSelesai(semua) && t.status === 'finished') {
        ops.push({ table: 'tournaments', type: 'update', id: t.id, patch: { status: 'ongoing' } })
      }
      return jalankan(
        ops,
        ligaSelesai(semua) ? 'Semua skor lengkap — juara liga sudah ditentukan!' : 'Skor tersimpan.',
      )
    },
    [jalankan, snapshot.league_matches],
  )

  const nilai: AppContextValue = {
    siap,
    memuat,
    galatMuat,
    info,
    masalahKonfigurasi,
    snapshot,
    klubAktif,
    klubTerakhir,
    statistik,
    toasts,
    sibuk,
    pilihKlub,
    muatUlang,
    tutupToast,
    pesan,
    simpanKlub,
    hapusKlub,
    simpanAnggota,
    hapusAnggota,
    pemakaianAnggota,
    simpanTurnamen,
    ubahTurnamen,
    hapusTurnamen,
    setStatus,
    mulaiKnockout,
    simpanHasil,
    hapusHasil,
    buatJadwalAmericano,
    buatJadwalLiga,
    simpanSkorLiga,
    simpanSkorAmericano,
  }

  return <AppContext.Provider value={nilai}>{children}</AppContext.Provider>
}

function samaGames(a: Game[], b: Game[]): boolean {
  if (a.length !== b.length) return false
  return a.every((g, i) => g.a === b[i].a && g.b === b[i].b)
}

/** Bandingkan bracket lama vs hasil hitung ulang, keluarkan operasi update seperlunya. */
function diffKnockout(lama: KnockoutMatch[], baru: KnockoutMatch[], turnamenId: string): Op[] {
  const lamaMap = new Map(lama.filter((m) => m.tournament_id === turnamenId).map((m) => [m.id, m]))
  const ops: Op[] = []
  for (const m of baru) {
    if (m.tournament_id !== turnamenId) continue
    const l = lamaMap.get(m.id)
    if (!l) {
      ops.push({ table: 'knockout_matches', type: 'insert', row: m })
      continue
    }
    const patch: Record<string, unknown> = {}
    if (l.participant_a !== m.participant_a) patch.participant_a = m.participant_a
    if (l.participant_b !== m.participant_b) patch.participant_b = m.participant_b
    if (!samaGames(l.games, m.games)) patch.games = m.games
    if (l.winner_id !== m.winner_id) patch.winner_id = m.winner_id
    if (Object.keys(patch).length) ops.push({ table: 'knockout_matches', type: 'update', id: m.id, patch })
  }
  return ops
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp harus dipakai di dalam AppProvider')
  return ctx
}
