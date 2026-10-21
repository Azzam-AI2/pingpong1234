import { useEffect, useMemo, useState } from 'react'
import { useApp, type DataPeserta } from '../state/AppContext'
import { PasanganBuilder } from './KnockoutView'
import {
  Avatar,
  Confetti,
  Input,
  Kartu,
  Kolom,
  Konfirmasi,
  Kosong,
  Lencana,
  Tombol,
} from './ui'
import type { Tournament } from '../lib/types'
import {
  hitungKlasemenLiga,
  juaraLiga,
  ligaSelesai,
  rondePenuhLiga,
  POIN_MAKS_LIGA,
  validasiSkorLiga,
} from '../lib/liga'
import { cls } from '../lib/utils'

interface Skor {
  a: string
  b: string
}

/** Mode Liga: semua peserta saling bertemu, juara = total poin tertinggi. */
export function LigaView({ turnamen }: { turnamen: Tournament }) {
  const { snapshot, buatJadwalLiga, simpanSkorLiga, sibuk } = useApp()
  const format = turnamen.format ?? 'single'
  const target = turnamen.target_points ?? POIN_MAKS_LIGA

  const anggota = useMemo(
    () =>
      snapshot.members
        .filter((m) => m.club_id === turnamen.club_id)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.members, turnamen.club_id],
  )

  const peserta = useMemo(
    () => snapshot.participants.filter((p) => p.tournament_id === turnamen.id),
    [snapshot.participants, turnamen.id],
  )

  const ronde = useMemo(
    () =>
      snapshot.league_rounds
        .filter((r) => r.tournament_id === turnamen.id)
        .slice()
        .sort((a, b) => a.round_no - b.round_no),
    [snapshot.league_rounds, turnamen.id],
  )

  const matches = useMemo(
    () =>
      snapshot.league_matches
        .filter((m) => m.tournament_id === turnamen.id)
        .slice()
        .sort((a, b) => a.round_no - b.round_no || a.court_no - b.court_no),
    [snapshot.league_matches, turnamen.id],
  )

  const namaAnggota = (id: string) => snapshot.members.find((m) => m.id === id)?.name ?? 'Anggota'
  const namaTim = (team: string[]) => team.map(namaAnggota).join(' & ')

  const klasemen = useMemo(
    () => hitungKlasemenLiga(peserta, matches, namaAnggota),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peserta, matches, snapshot.members],
  )

  const selesaiSemua = ligaSelesai(matches)
  const juara = turnamen.status === 'finished' ? juaraLiga(klasemen.utama) : []
  const jumlahRondePenuh = rondePenuhLiga(peserta.length || anggota.length)

  // ------------------------------------------------------------- form jadwal
  const [pilihSingle, setPilihSingle] = useState<string[]>([])
  const [pasangan, setPasangan] = useState<{ a: string; b: string }[]>([])
  const [jumlahRonde, setJumlahRonde] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasiReset, setKonfirmasiReset] = useState(false)

  useEffect(() => {
    if (!ronde.length && format === 'single') setPilihSingle(anggota.map((m) => m.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnamen.id, anggota.length, format])

  const daftarUntukJadwal = (): DataPeserta[] => {
    if (format === 'double') {
      return pasangan.map((p) => ({
        label: `${namaAnggota(p.a)} / ${namaAnggota(p.b)}`,
        member_ids: [p.a, p.b],
      }))
    }
    return pilihSingle.map((id) => ({ label: namaAnggota(id), member_ids: [id] }))
  }

  const buatJadwal = async (acakUlang = false) => {
    const daftar = daftarUntukJadwal()
    if (daftar.length < 2) {
      setGalat('Pilih minimal 2 peserta.')
      return
    }
    if (format === 'double') {
      const dipakai = new Set<string>()
      for (const p of daftar) {
        for (const id of p.member_ids) {
          if (dipakai.has(id)) {
            setGalat(`Anggota ${namaAnggota(id)} dipakai di lebih dari satu pasangan.`)
            return
          }
          dipakai.add(id)
        }
      }
    }
    const r = jumlahRonde.trim() === '' ? null : Number(jumlahRonde)
    if (r !== null && (!Number.isInteger(r) || r < 1 || r > 60)) {
      setGalat('Jumlah ronde harus 1-60 (atau kosongkan untuk semua peserta bertemu sekali).')
      return
    }
    setGalat(null)
    await buatJadwalLiga(turnamen, daftar, r, acakUlang)
  }

  // ------------------------------------------------------------- input skor
  const [skor, setSkor] = useState<Record<string, Skor>>({})

  useEffect(() => {
    const awal: Record<string, Skor> = {}
    for (const m of matches) {
      awal[m.id] = {
        a: m.score_a === null ? '' : String(m.score_a),
        b: m.score_b === null ? '' : String(m.score_b),
      }
    }
    setSkor(awal)
  }, [matches])

  const ubah = (id: string, sisi: 'a' | 'b', nilai: string) =>
    setSkor((prev) => ({
      ...prev,
      [id]: {
        a: prev[id]?.a ?? '',
        b: prev[id]?.b ?? '',
        [sisi]: nilai.replace(/[^0-9]/g, '').slice(0, 2),
      } as Skor,
    }))

  const simpan = async (matchId: string) => {
    const s = skor[matchId] ?? { a: '', b: '' }
    if (s.a === '' && s.b === '') {
      await simpanSkorLiga(turnamen, matchId, null, null)
      return
    }
    if (s.a === '' || s.b === '') {
      setGalat('Isi kedua skor, atau kosongkan keduanya untuk membatalkan.')
      return
    }
    setGalat(null)
    await simpanSkorLiga(turnamen, matchId, Number(s.a), Number(s.b))
  }

  const peringatanSkor = (s: Skor): string | null => {
    if (s.a === '' || s.b === '') return null
    const a = Number(s.a)
    const b = Number(s.b)
    if (a === b) return 'Skor tidak boleh seri.'
    const cek = validasiSkorLiga(a, b, target)
    return cek.ok ? null : (cek.error ?? null)
  }

  return (
    <div className="space-y-4">
      <Confetti aktif={juara.length > 0} />

      {juara.length > 0 && (
        <Kartu className="animate-pop-in border-accent-500/40 bg-accent-500/10 text-center">
          <p className="text-3xl">🏆</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-accent-900/80">
            Juara Liga {turnamen.name}
          </p>
          <p className="text-xl font-semibold text-accent-900">
            {juara.map((j) => j.nama).join(' & ')}
          </p>
          <p className="mt-1 text-xs text-accent-900/80">
            {juara[0].totalPoin} poin dari {juara[0].main} pertandingan (rata-rata {juara[0].rataRata})
          </p>
        </Kartu>
      )}

      {!ronde.length ? (
        <Kartu className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-soft">
              Pilih peserta liga ({format === 'double' ? 'pasangan tetap' : 'pemain'})
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {format === 'double'
                ? 'Pasangan tetap selama liga. Satu anggota hanya boleh masuk satu pasangan.'
                : 'Setiap peserta akan bertemu peserta lain.'}{' '}
              Setiap pertandingan dimainkan sampai {target} poin (maksimal {target}); skor yang
              dicetak dijumlahkan sepanjang liga.
            </p>
          </div>

          {anggota.length < 2 ? (
            <Kosong
              judul="Anggota klub belum cukup"
              pesan="Tambahkan minimal 2 anggota di menu Anggota dulu."
            />
          ) : format === 'single' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {anggota.map((m) => (
                <label
                  key={m.id}
                  className={cls(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2',
                    pilihSingle.includes(m.id)
                      ? 'border-brand-600/50 bg-brand-500/10'
                      : 'border-ink/12 bg-ink/6',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-500"
                    checked={pilihSingle.includes(m.id)}
                    onChange={() =>
                      setPilihSingle((prev) =>
                        prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id],
                      )
                    }
                  />
                  <Avatar nama={m.name} src={m.photo_url} ukuran={30} />
                  <span className="text-sm text-ink">{m.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <PasanganBuilder
              anggota={anggota}
              pasangan={pasangan}
              onTambah={(a, b) => setPasangan((prev) => [...prev, { a, b }])}
              onHapus={(i) => setPasangan((prev) => prev.filter((_, idx) => idx !== i))}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Kolom
              label="Jumlah ronde"
              petunjuk={`Kosongkan = semua peserta bertemu sekali (${jumlahRondePenuh} ronde).`}
            >
              <Input
                inputMode="numeric"
                value={jumlahRonde}
                onChange={(e) => setJumlahRonde(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={String(jumlahRondePenuh)}
              />
            </Kolom>
          </div>

          {galat && <p className="text-sm text-rose-700">{galat}</p>}

          <Tombol onClick={() => buatJadwal(false)} disabled={sibuk || anggota.length < 2}>
            📅 Buat jadwal liga
          </Tombol>
        </Kartu>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Lencana warna="biru">{peserta.length} peserta</Lencana>
            <Lencana>{ronde.length} ronde</Lencana>
            <Lencana>{matches.length} pertandingan</Lencana>
            <Lencana>Target {target} poin</Lencana>
            {selesaiSemua && <Lencana warna="hijau">semua skor lengkap</Lencana>}
            <span className="flex-1" />
            <Tombol kecil variasi="sekunder" onClick={() => setKonfirmasiReset(true)} disabled={sibuk}>
              🎲 Acak ulang jadwal
            </Tombol>
          </div>

          <div className="space-y-3">
            {ronde.map((r) => {
              const matchesRonde = matches.filter((m) => m.round_id === r.id)
              const bermain = new Set(matchesRonde.flatMap((m) => [...m.team_a, ...m.team_b]))
              const istirahat = peserta
                .filter((p) => p.member_ids.every((id) => !bermain.has(id)))
                .map((p) => p.label)
              return (
                <Kartu key={r.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink">Ronde {r.round_no}</h3>
                    {matchesRonde.every((m) => m.score_a !== null && m.score_b !== null) && (
                      <Lencana warna="hijau">skor lengkap</Lencana>
                    )}
                  </div>

                  {matchesRonde.map((m) => {
                    const s = skor[m.id] ?? { a: '', b: '' }
                    const ada = m.score_a !== null && m.score_b !== null
                    const salah = peringatanSkor(s)
                    return (
                      <div key={m.id} className="rounded-xl border border-ink/12 bg-ink/[0.04] p-3">
                        <p className="text-xs text-ink-muted">Lapangan {m.court_no}</p>
                        <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-sm text-ink">
                              <span className="truncate">{namaTim(m.team_a)}</span>
                              {ada && m.score_a !== null && m.score_b !== null && (
                                <span className={m.score_a > m.score_b ? 'text-emerald-800' : 'text-ink-muted'}>
                                  {m.score_a > m.score_b ? 'menang' : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-sm text-ink">
                              <span className="truncate">{namaTim(m.team_b)}</span>
                              {ada && m.score_a !== null && m.score_b !== null && (
                                <span className={m.score_b > m.score_a ? 'text-emerald-800' : 'text-ink-muted'}>
                                  {m.score_b > m.score_a ? 'menang' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              inputMode="numeric"
                              className="w-16 text-center"
                              value={s.a}
                              onChange={(e) => ubah(m.id, 'a', e.target.value)}
                              placeholder="0"
                            />
                            <span className="text-ink-faint">-</span>
                            <Input
                              inputMode="numeric"
                              className="w-16 text-center"
                              value={s.b}
                              onChange={(e) => ubah(m.id, 'b', e.target.value)}
                              placeholder="0"
                            />
                            <Tombol kecil variasi="sekunder" onClick={() => simpan(m.id)} disabled={sibuk}>
                              Simpan
                            </Tombol>
                          </div>
                        </div>
                        {salah && <p className="mt-1 text-xs text-rose-700">{salah}</p>}
                      </div>
                    )
                  })}

                  {istirahat.length > 0 && (
                    <p className="text-xs text-accent-900">Istirahat: {istirahat.join(', ')}</p>
                  )}
                </Kartu>
              )
            })}
          </div>

          <Kartu className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">
              Klasemen liga {format === 'double' ? '(peringkat pasangan)' : '(peringkat pemain)'}
            </h3>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">{format === 'double' ? 'Pasangan' : 'Pemain'}</th>
                    <th className="px-2 py-2 text-right">Main</th>
                    <th className="px-2 py-2 text-right">Total poin</th>
                    <th className="px-2 py-2 text-right">M / K</th>
                    <th className="px-2 py-2 text-right">Rata-rata</th>
                  </tr>
                </thead>
                <tbody>
                  {klasemen.utama.map((k) => (
                    <tr
                      key={k.kunci}
                      className={cls(
                        'border-t border-ink/8',
                        juara.some((j) => j.kunci === k.kunci) && 'bg-accent-500/10',
                      )}
                    >
                      <td className="px-2 py-2 text-ink-muted">{k.peringkat}</td>
                      <td className="px-2 py-2 text-ink">
                        {k.nama}
                        {juara.some((j) => j.kunci === k.kunci) && ' 🏆'}
                      </td>
                      <td className="px-2 py-2 text-right text-ink-soft">{k.main}</td>
                      <td className="px-2 py-2 text-right font-semibold text-ink">{k.totalPoin}</td>
                      <td className="px-2 py-2 text-right text-ink-soft">
                        {k.menang} / {k.kalah}
                      </td>
                      <td className="px-2 py-2 text-right text-ink-soft">{k.rataRata}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-muted">
              Juara = total poin tertinggi; seri diputus rata-rata poin lalu jumlah kemenangan. Poin
              dihitung ulang dari hasil tersimpan, jadi mengedit atau membatalkan skor tidak pernah
              menghitung ganda.
            </p>

            {format === 'double' && klasemen.pemain.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Statistik individu (tidak menambah poin klasemen pasangan)
                </p>
                <div className="-mx-2 overflow-x-auto">
                  <table className="w-full min-w-[24rem] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                        <th className="px-2 py-2">Pemain</th>
                        <th className="px-2 py-2 text-right">Main</th>
                        <th className="px-2 py-2 text-right">Poin</th>
                        <th className="px-2 py-2 text-right">Rata-rata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {klasemen.pemain.map((p) => (
                        <tr key={p.kunci} className="border-t border-ink/8">
                          <td className="px-2 py-2 text-ink">{p.nama}</td>
                          <td className="px-2 py-2 text-right text-ink-soft">{p.main}</td>
                          <td className="px-2 py-2 text-right text-ink-soft">{p.totalPoin}</td>
                          <td className="px-2 py-2 text-right text-ink-soft">{p.rataRata}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!selesaiSemua && (
              <p className="text-xs text-accent-900">
                Klasemen bersifat sementara. Poin hanya dihitung dari pertandingan yang skornya sudah
                lengkap.
              </p>
            )}
          </Kartu>
        </>
      )}

      <Konfirmasi
        terbuka={konfirmasiReset}
        judul="Acak ulang jadwal liga?"
        pesan="Jadwal baru akan dibuat dan semua skor yang sudah diisi di liga ini akan dihapus."
        teksYa="Acak ulang"
        onBatal={() => setKonfirmasiReset(false)}
        onYa={async () => {
          setKonfirmasiReset(false)
          await buatJadwal(true)
        }}
      />
    </div>
  )
}
