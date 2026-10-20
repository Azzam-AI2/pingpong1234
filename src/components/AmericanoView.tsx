import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
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
import { americanoStandings, suggestRounds } from '../lib/americano'
import { cls } from '../lib/utils'

interface Skor {
  a: string
  b: string
}

export function AmericanoView({ turnamen }: { turnamen: Tournament }) {
  const { snapshot, buatJadwalAmericano, simpanSkorAmericano, pesan, sibuk } = useApp()

  const anggota = useMemo(
    () =>
      snapshot.members
        .filter((m) => m.club_id === turnamen.club_id)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.members, turnamen.club_id],
  )

  const ronde = useMemo(
    () =>
      snapshot.americano_rounds
        .filter((r) => r.tournament_id === turnamen.id)
        .slice()
        .sort((a, b) => a.round_no - b.round_no),
    [snapshot.americano_rounds, turnamen.id],
  )

  const matches = useMemo(
    () =>
      snapshot.americano_matches
        .filter((m) => m.tournament_id === turnamen.id)
        .slice()
        .sort((a, b) => a.round_no - b.round_no || a.table_no - b.table_no),
    [snapshot.americano_matches, turnamen.id],
  )

  const namaAnggota = (id: string) => snapshot.members.find((m) => m.id === id)?.name ?? 'Pemain'

  const pemainIds = useMemo(() => {
    const set = new Set<string>()
    for (const m of matches) for (const id of [...m.team_a, ...m.team_b]) set.add(id)
    for (const p of snapshot.participants.filter((x) => x.tournament_id === turnamen.id)) {
      for (const id of p.member_ids) set.add(id)
    }
    return [...set]
  }, [matches, snapshot.participants, turnamen.id])

  const klasemen = useMemo(() => americanoStandings(pemainIds, matches), [pemainIds, matches])
  const selesaiSemua = matches.length > 0 && matches.every((m) => m.score_a !== null && m.score_b !== null)
  const juara = turnamen.status === 'finished' ? klasemen.filter((k) => k.rank === 1 && k.matches > 0) : []

  // ------------------------------------------------------------- form awal
  const [pilih, setPilih] = useState<string[]>([])
  const [jumlahRonde, setJumlahRonde] = useState<string>('')
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasiAcak, setKonfirmasiAcak] = useState(false)

  useEffect(() => {
    if (!ronde.length) setPilih(anggota.map((m) => m.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnamen.id, anggota.length])

  const saranRonde = suggestRounds(pilih.length || anggota.length)

  const buatJadwal = async () => {
    if (pilih.length < 4) {
      setGalat('Americano butuh minimal 4 pemain.')
      return
    }
    const r = jumlahRonde.trim() === '' ? saranRonde : Number(jumlahRonde)
    if (!Number.isInteger(r) || r < 1 || r > 30) {
      setGalat('Jumlah ronde harus 1-30.')
      return
    }
    setGalat(null)
    await buatJadwalAmericano(turnamen, pilih, r, false)
  }

  // ------------------------------------------------------------ input skor
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
      await simpanSkorAmericano(turnamen, matchId, null, null)
      return
    }
    if (s.a === '' || s.b === '') {
      pesan('Isi kedua skor, atau kosongkan keduanya.', 'error')
      return
    }
    await simpanSkorAmericano(turnamen, matchId, Number(s.a), Number(s.b))
  }

  // ----------------------------------------------------------------- timer
  const menit = turnamen.match_duration_min ?? 0
  const [sisa, setSisa] = useState(menit * 60)
  const [jalan, setJalan] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!jalan) {
      if (timerRef.current) window.clearInterval(timerRef.current)
      return
    }
    timerRef.current = window.setInterval(() => {
      setSisa((prev) => {
        if (prev <= 1) {
          setJalan(false)
          pesan('Waktu pertandingan ronde ini habis.', 'info')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [jalan, pesan])

  const mmss = `${String(Math.floor(sisa / 60)).padStart(2, '0')}:${String(sisa % 60).padStart(2, '0')}`

  return (
    <div className="space-y-4">
      <Confetti aktif={juara.length > 0} />

      {juara.length > 0 && (
        <Kartu className="animate-pop-in border-amber-400/40 bg-amber-500/10 text-center">
          <p className="text-3xl">🏆</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-amber-200/80">Juara Americano</p>
          <p className="text-xl font-semibold text-amber-100">
            {juara.map((k) => namaAnggota(k.memberId)).join(' & ')}
          </p>
          <p className="mt-1 text-xs text-amber-100/80">
            {juara[0].points} poin dari {juara[0].matches} pertandingan
          </p>
        </Kartu>
      )}

      {!ronde.length ? (
        <Kartu className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Pilih pemain & jumlah ronde</h2>
            <p className="mt-1 text-xs text-slate-400">
              Jumlah ideal kelipatan 4. Kalau tidak, pemain sisa istirahat bergiliran tiap ronde dan tetap
              mendapat poin saat bermain.
            </p>
          </div>

          {anggota.length < 4 ? (
            <Kosong judul="Pemain belum cukup" pesan="Americano butuh minimal 4 anggota klub." />
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {anggota.map((m) => (
                  <label
                    key={m.id}
                    className={cls(
                      'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2',
                      pilih.includes(m.id)
                        ? 'border-brand-400/50 bg-brand-500/10'
                        : 'border-white/10 bg-white/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-500"
                      checked={pilih.includes(m.id)}
                      onChange={() =>
                        setPilih((prev) =>
                          prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id],
                        )
                      }
                    />
                    <Avatar nama={m.name} src={m.photo_url} ukuran={30} />
                    <span className="text-sm text-slate-100">{m.name}</span>
                  </label>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Kolom
                  label="Jumlah ronde"
                  petunjuk={`Saran otomatis: ${saranRonde} ronde untuk ${pilih.length || 0} pemain.`}
                >
                  <Input
                    inputMode="numeric"
                    value={jumlahRonde}
                    onChange={(e) => setJumlahRonde(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder={String(saranRonde)}
                  />
                </Kolom>
                <div className="flex items-end">
                  <div className="text-xs text-slate-400">
                    <p>Target poin: {turnamen.target_points} per pertandingan.</p>
                    <p>{pilih.length % 4 !== 0 && pilih.length >= 4 ? `${pilih.length % 4} pemain istirahat per ronde.` : 'Semua pemain bermain tiap ronde.'}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {galat && <p className="text-sm text-rose-400">{galat}</p>}

          <Tombol onClick={buatJadwal} disabled={sibuk || anggota.length < 4}>
            🎲 Buat jadwal rotasi pasangan
          </Tombol>
        </Kartu>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Lencana warna="biru">{pemainIds.length} pemain</Lencana>
            <Lencana>{ronde.length} ronde</Lencana>
            <Lencana>Target {turnamen.target_points} poin</Lencana>
            <span className="flex-1" />
            <Tombol kecil variasi="sekunder" onClick={() => setKonfirmasiAcak(true)} disabled={sibuk}>
              🎲 Acak ulang jadwal
            </Tombol>
          </div>

          {menit > 0 && (
            <Kartu className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Timer pertandingan ({menit} menit)</p>
                <p className="text-2xl font-semibold tabular-nums text-slate-100">{mmss}</p>
              </div>
              <div className="flex gap-2">
                <Tombol kecil onClick={() => setJalan((v) => !v)}>
                  {jalan ? 'Jeda' : 'Mulai'}
                </Tombol>
                <Tombol
                  kecil
                  variasi="sekunder"
                  onClick={() => {
                    setJalan(false)
                    setSisa(menit * 60)
                  }}
                >
                  Reset
                </Tombol>
              </div>
            </Kartu>
          )}

          <div className="space-y-3">
            {ronde.map((r) => {
              const matchesRonde = matches.filter((m) => m.round_id === r.id)
              const bermain = new Set(matchesRonde.flatMap((m) => [...m.team_a, ...m.team_b]))
              const istirahat = pemainIds.filter((id) => !bermain.has(id))
              return (
                <Kartu key={r.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">Ronde {r.round_no}</h3>
                    {matchesRonde.every((m) => m.score_a !== null && m.score_b !== null) && (
                      <Lencana warna="hijau">skor lengkap</Lencana>
                    )}
                  </div>

                  {matchesRonde.map((m) => {
                    const s = skor[m.id] ?? { a: '', b: '' }
                    const ada = m.score_a !== null && m.score_b !== null
                    return (
                      <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-xs text-slate-400">Meja {m.table_no}</p>
                        <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-sm text-slate-100">
                              <span className="truncate">
                                {m.team_a.map((id) => namaAnggota(id)).join(' & ')}
                              </span>
                              {ada && m.score_a !== null && m.score_b !== null && (
                                <span className={m.score_a > m.score_b ? 'text-emerald-300' : 'text-slate-400'}>
                                  {m.score_a > m.score_b ? 'menang' : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-sm text-slate-100">
                              <span className="truncate">
                                {m.team_b.map((id) => namaAnggota(id)).join(' & ')}
                              </span>
                              {ada && m.score_a !== null && m.score_b !== null && (
                                <span className={m.score_b > m.score_a ? 'text-emerald-300' : 'text-slate-400'}>
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
                            <span className="text-slate-500">-</span>
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
                      </div>
                    )
                  })}

                  {istirahat.length > 0 && (
                    <p className="text-xs text-amber-200">
                      Istirahat: {istirahat.map((id) => namaAnggota(id)).join(', ')}
                    </p>
                  )}
                </Kartu>
              )
            })}
          </div>

          <Kartu className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">Klasemen individu</h3>
              {selesaiSemua && <Lencana warna="hijau">Semua skor lengkap</Lencana>}
            </div>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Pemain</th>
                    <th className="px-2 py-2 text-right">Main</th>
                    <th className="px-2 py-2 text-right">M / K</th>
                    <th className="px-2 py-2 text-right">Poin</th>
                  </tr>
                </thead>
                <tbody>
                  {klasemen.map((k) => (
                    <tr key={k.memberId} className="border-t border-white/5">
                      <td className="px-2 py-2 text-slate-400">{k.rank}</td>
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2">
                          <Avatar nama={namaAnggota(k.memberId)} ukuran={26} />
                          <span className="truncate text-slate-100">{namaAnggota(k.memberId)}</span>
                          {juara.some((j) => j.memberId === k.memberId) && <span>🏆</span>}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-slate-300">{k.matches}</td>
                      <td className="px-2 py-2 text-right text-slate-300">
                        {k.wins} / {k.losses}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-slate-100">{k.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400">
              Poin Americano = jumlah poin yang dicetak timmu (kedua pemain satu tim dapat poin sama). Poin ini
              tidak digabung dengan statistik knockout.
            </p>
          </Kartu>
        </>
      )}

      <Konfirmasi
        terbuka={konfirmasiAcak}
        judul="Acak ulang jadwal?"
        pesan="Jadwal rotasi baru akan dibuat dan semua skor yang sudah diisi di turnamen ini akan dihapus."
        teksYa="Acak ulang"
        onBatal={() => setKonfirmasiAcak(false)}
        onYa={async () => {
          setKonfirmasiAcak(false)
          await buatJadwalAmericano(turnamen, pemainIds, ronde.length, true)
        }}
      />
    </div>
  )
}
