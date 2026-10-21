import { useEffect, useMemo, useState } from 'react'
import { useApp, type DataPeserta } from '../state/AppContext'
import {
  Avatar,
  Confetti,
  Input,
  Kartu,
  Kolom,
  Konfirmasi,
  Kosong,
  Lencana,
  Modal,
  Tombol,
} from './ui'
import type { Game, KnockoutMatch, Tournament } from '../lib/types'
import {
  gamesToWin,
  labelBabak,
  pemenangTurnamen,
  validateGames,
} from '../lib/knockout'
import { cls } from '../lib/utils'

interface SkorForm {
  a: string
  b: string
}

export function KnockoutView({ turnamen }: { turnamen: Tournament }) {
  const { snapshot, mulaiKnockout, simpanHasil, hapusHasil, sibuk } = useApp()
  const bestOf = turnamen.best_of ?? 3
  const butuhMenang = gamesToWin(bestOf)

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

  const matches = useMemo(
    () =>
      snapshot.knockout_matches
        .filter((m) => m.tournament_id === turnamen.id)
        .slice()
        .sort((a, b) => a.round - b.round || a.position - b.position),
    [snapshot.knockout_matches, turnamen.id],
  )

  const babak = useMemo(() => [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b), [matches])
  const juara = pemenangTurnamen(matches, bestOf)

  const namaPeserta = (id: string | null) =>
    id ? (peserta.find((p) => p.id === id)?.label ?? 'Peserta terhapus') : null

  // --------------------------------------------------------- form peserta
  const [pilihSingle, setPilihSingle] = useState<string[]>([])
  const [pasangan, setPasangan] = useState<{ a: string; b: string }[]>([])
  const [galatPeserta, setGalatPeserta] = useState<string | null>(null)
  const [konfirmasiUlang, setKonfirmasiUlang] = useState(false)

  useEffect(() => {
    if (turnamen.format === 'single' && !matches.length) {
      setPilihSingle(anggota.map((m) => m.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnamen.id, anggota.length])

  const toggleSingle = (id: string) =>
    setPilihSingle((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const tambahPasangan = (a: string, b: string) => {
    if (!a || !b) return
    setPasangan((prev) => [...prev, { a, b }])
  }

  const daftarUntukUndian = (): DataPeserta[] => {
    if (turnamen.format === 'double') {
      return pasangan.map((p) => ({
        label: `${namaAnggota(p.a)} / ${namaAnggota(p.b)}`,
        member_ids: [p.a, p.b],
      }))
    }
    return pilihSingle.map((id) => ({ label: namaAnggota(id), member_ids: [id] }))
  }

  function namaAnggota(id: string): string {
    return anggota.find((m) => m.id === id)?.name ?? 'Anggota'
  }

  const undi = async (ulangi: boolean) => {
    const daftar = daftarUntukUndian()
    if (daftar.length < 2) {
      setGalatPeserta('Pilih minimal 2 peserta.')
      return
    }
    if (turnamen.format === 'double') {
      const dipakai = new Set<string>()
      for (const p of daftar) {
        for (const id of p.member_ids) {
          if (dipakai.has(id)) {
            setGalatPeserta(`Anggota ${namaAnggota(id)} dipakai di lebih dari satu pasangan.`)
            return
          }
          dipakai.add(id)
        }
      }
    }
    setGalatPeserta(null)
    await mulaiKnockout(turnamen, daftar, ulangi)
  }

  // ------------------------------------------------------------ input skor
  const [matchAktif, setMatchAktif] = useState<string | null>(null)
  const [skor, setSkor] = useState<SkorForm[]>([{ a: '', b: '' }])
  const [galatSkor, setGalatSkor] = useState<string | null>(null)
  const [konfirmasiSimpan, setKonfirmasiSimpan] = useState(false)

  const matchObj = matchAktif ? matches.find((m) => m.id === matchAktif) ?? null : null

  const bukaSkor = (m: KnockoutMatch) => {
    const awal: SkorForm[] = m.games.length
      ? m.games.map((g) => ({ a: String(g.a), b: String(g.b) }))
      : [{ a: '', b: '' }]
    setSkor(awal)
    setGalatSkor(null)
    setMatchAktif(m.id)
  }

  const ubahSkor = (idx: number, sisi: 'a' | 'b', nilai: string) =>
    setSkor((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, [sisi]: nilai.replace(/[^0-9]/g, '').slice(0, 2) } : g)),
    )

  const skorKeGames = (): Game[] | null => {
    const games: Game[] = []
    for (const g of skor) {
      if (g.a === '' && g.b === '') continue
      if (g.a === '' || g.b === '') return null
      games.push({ a: Number(g.a), b: Number(g.b) })
    }
    return games
  }

  const menangSementara = (() => {
    const games = skorKeGames() ?? []
    let a = 0
    let b = 0
    for (const g of games) {
      if (g.a > g.b) a++
      else if (g.b > g.a) b++
    }
    return { a, b }
  })()

  const sudahSelesai = menangSementara.a >= butuhMenang || menangSementara.b >= butuhMenang

  const simpanSkor = async () => {
    if (!matchObj) return
    const games = skorKeGames()
    if (!games) {
      setGalatSkor('Setiap game harus punya dua skor. Kosongkan baris game yang tidak dipakai.')
      return
    }
    const cek = validateGames(games, bestOf)
    if (!cek.ok) {
      setGalatSkor(cek.error ?? 'Skor tidak valid.')
      return
    }
    setGalatSkor(null)
    setMatchAktif(null)
    await simpanHasil(turnamen, matchObj.id, games)
  }

  const juaraLabel = namaPeserta(juara)

  return (
    <div className="space-y-4">
      <Confetti aktif={Boolean(juara)} />

      {juaraLabel && (
        <Kartu className="animate-pop-in border-amber-400/40 bg-amber-500/10 text-center">
          <p className="text-3xl">🏆</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-amber-200/80">Juara {turnamen.name}</p>
          <p className="text-xl font-semibold text-amber-100">{juaraLabel}</p>
          <p className="mt-1 text-xs text-amber-100/80">
            Menang {bestOf === 5 ? '3' : '2'} game di partai final · Best of {bestOf}
          </p>
        </Kartu>
      )}

      {!matches.length ? (
        <Kartu className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Pilih peserta ({turnamen.format === 'double' ? 'pasangan double' : 'pemain single'})
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {turnamen.format === 'double'
                ? 'Tentukan pasangan sebelum turnamen dimulai. Satu anggota hanya boleh ikut satu pasangan.'
                : 'Pilih anggota yang ikut turnamen. Nama peserta mengikuti nama anggota.'}
            </p>
          </div>

          {anggota.length < 2 ? (
            <Kosong
              judul="Anggota klub belum cukup"
              pesan="Tambahkan minimal 2 anggota di menu Klub & Anggota dulu."
            />
          ) : turnamen.format === 'single' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {anggota.map((m) => (
                <label
                  key={m.id}
                  className={cls(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2',
                    pilihSingle.includes(m.id)
                      ? 'border-brand-400/50 bg-brand-500/10'
                      : 'border-white/10 bg-white/5',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-500"
                    checked={pilihSingle.includes(m.id)}
                    onChange={() => toggleSingle(m.id)}
                  />
                  <Avatar nama={m.name} src={m.photo_url} ukuran={30} />
                  <span className="text-sm text-slate-100">{m.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <PasanganBuilder
              anggota={anggota}
              pasangan={pasangan}
              onTambah={tambahPasangan}
              onHapus={(i) => setPasangan((prev) => prev.filter((_, idx) => idx !== i))}
            />
          )}

          {galatPeserta && <p className="text-sm text-rose-400">{galatPeserta}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Tombol onClick={() => undi(false)} disabled={sibuk}>
              🎲 Undi bracket acak
            </Tombol>
            <span className="text-xs text-slate-400">
              Jumlah peserta bukan pangkat dua? Bye dibuat otomatis.
            </span>
          </div>
        </Kartu>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Lencana warna="biru">{peserta.length} peserta</Lencana>
            <Lencana>{matches.length} pertandingan</Lencana>
            <Lencana>Best of {bestOf}</Lencana>
            <span className="flex-1" />
            <Tombol kecil variasi="sekunder" onClick={() => setKonfirmasiUlang(true)} disabled={sibuk}>
              🎲 Undi ulang bracket
            </Tombol>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 pb-2">
            <div className="flex min-w-max gap-3">
              {babak.map((r) => (
                <div key={r} className="w-[15rem] shrink-0 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {labelBabak(matches, r)}
                  </p>
                  {matches
                    .filter((m) => m.round === r)
                    .map((m) => {
                      const menang = m.winner_id ? namaPeserta(m.winner_id) : null
                      const bye = m.round === 1 && !m.participant_a !== !m.participant_b
                      const bisaDiisi = Boolean(m.participant_a && m.participant_b)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => bisaDiisi && bukaSkor(m)}
                          className={cls(
                            'w-full rounded-xl border p-2.5 text-left transition-colors',
                            bisaDiisi
                              ? 'border-white/10 bg-white/5 hover:border-brand-400/40 hover:bg-white/10'
                              : 'border-dashed border-white/10 bg-white/[0.02]',
                          )}
                        >
                          {[['a', m.participant_a], ['b', m.participant_b]].map(([sisi, pid]) => {
                            const nama = namaPeserta(pid as string | null)
                            const adalahPemenang = Boolean(pid) && pid === m.winner_id
                            return (
                              <div
                                key={sisi as string}
                                className={cls(
                                  'flex items-center justify-between gap-2 text-sm',
                                  adalahPemenang ? 'font-semibold text-emerald-200' : 'text-slate-200',
                                )}
                              >
                                <span className="truncate">{nama ?? '—'}</span>
                                {adalahPemenang && <span>✓</span>}
                              </div>
                            )
                          })}
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                            {m.games.length ? (
                              <span className="text-slate-300">
                                {m.games.map((g) => `${g.a}-${g.b}`).join(' · ')}
                              </span>
                            ) : bye ? (
                              <span className="text-amber-200">bye — lolos otomatis</span>
                            ) : bisaDiisi ? (
                              <span className="text-slate-400">Belum ada skor — ketuk untuk isi</span>
                            ) : (
                              <span className="text-slate-500">Menunggu pemenang babak sebelumnya</span>
                            )}
                            {menang && m.games.length > 0 && <span className="text-emerald-300">menang</span>}
                          </div>
                        </button>
                      )
                    })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tombol
              variasi="sekunder"
              kecil
              onClick={() => {
                const final = matches.find((m) => m.round === Math.max(...babak))
                if (final) bukaSkor(final)
              }}
              disabled={!matches.find((m) => m.round === Math.max(...babak) && m.participant_a && m.participant_b)}
            >
              Buka partai final
            </Tombol>
            <span className="text-xs text-slate-400">
              Ketuk salah satu kartu pertandingan untuk memasukkan skor tiap game.
            </span>
          </div>
        </>
      )}

      {/* --------------------------------------------------- modal skor */}
      <Modal
        judul={matchObj ? `Skor · ${labelBabak(matches, matchObj.round)}` : 'Skor'}
        terbuka={matchObj !== null}
        onTutup={() => setMatchAktif(null)}
        aksi={
          matchObj ? (
            <>
              {matchObj.games.length > 0 && (
                <Tombol
                  variasi="bahaya"
                  onClick={async () => {
                    const id = matchObj.id
                    setMatchAktif(null)
                    await hapusHasil(turnamen, id)
                  }}
                  disabled={sibuk}
                >
                  Hapus skor
                </Tombol>
              )}
              <Tombol variasi="sekunder" onClick={() => setMatchAktif(null)}>
                Batal
              </Tombol>
              <Tombol
                onClick={() => {
                  if (matchObj.games.length > 0) setKonfirmasiSimpan(true)
                  else void simpanSkor()
                }}
                disabled={sibuk}
              >
                Simpan hasil
              </Tombol>
            </>
          ) : null
        }
      >
        {matchObj && (
          <>
            <div className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between text-sm font-medium text-slate-100">
                <span className="truncate">{namaPeserta(matchObj.participant_a)}</span>
                <span className="text-slate-400">vs</span>
                <span className="truncate text-right">{namaPeserta(matchObj.participant_b)}</span>
              </div>
              <p className="text-center text-xs text-slate-400">
                Best of {bestOf} · butuh {butuhMenang} game kemenangan
              </p>
              <p className="text-center text-xs text-brand-200">
                Setiap game dimainkan sampai 11 poin (mis. 11-9, 11-10, 5-11).
              </p>
            </div>

            <div className="space-y-2">
              {skor.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 text-xs text-slate-400">Game {i + 1}</span>
                  <Input
                    inputMode="numeric"
                    className="w-20 text-center"
                    value={g.a}
                    onChange={(e) => ubahSkor(i, 'a', e.target.value)}
                    placeholder="0"
                  />
                  <span className="text-slate-500">-</span>
                  <Input
                    inputMode="numeric"
                    className="w-20 text-center"
                    value={g.b}
                    onChange={(e) => ubahSkor(i, 'b', e.target.value)}
                    placeholder="0"
                  />
                  {skor.length > 1 && (
                    <Tombol
                      kecil
                      variasi="hantu"
                      onClick={() => setSkor((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      Hapus
                    </Tombol>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Tombol
                kecil
                variasi="sekunder"
                disabled={skor.length >= bestOf || sudahSelesai}
                onClick={() => setSkor((prev) => [...prev, { a: '', b: '' }])}
              >
                + Tambah game
              </Tombol>
              <span className={cls('text-xs', sudahSelesai ? 'text-emerald-300' : 'text-slate-400')}>
                Kedudukan game {menangSementara.a} - {menangSementara.b}
              </span>
            </div>

            {galatSkor && <p className="text-sm text-rose-400">{galatSkor}</p>}
          </>
        )}
      </Modal>

      <Konfirmasi
        terbuka={konfirmasiSimpan}
        judul="Ganti hasil pertandingan?"
        pesan="Skor lama akan diganti. Hasil pertandingan lanjutan yang bergantung pada pemenang ini akan direset dan harus diisi ulang."
        teksYa="Ganti hasil"
        onBatal={() => setKonfirmasiSimpan(false)}
        onYa={async () => {
          setKonfirmasiSimpan(false)
          await simpanSkor()
        }}
      />

      <Konfirmasi
        terbuka={konfirmasiUlang}
        judul="Undi ulang bracket?"
        pesan="Seluruh pasangan peserta dan semua skor yang sudah diisi akan dihapus, lalu diundi ulang secara acak."
        teksYa="Undi ulang"
        onBatal={() => setKonfirmasiUlang(false)}
        onYa={async () => {
          setKonfirmasiUlang(false)
          await undi(true)
        }}
      />
    </div>
  )
}

export function PasanganBuilder({
  anggota,
  pasangan,
  onTambah,
  onHapus,
}: {
  anggota: { id: string; name: string; photo_url: string | null }[]
  pasangan: { a: string; b: string }[]
  onTambah: (a: string, b: string) => void
  onHapus: (i: number) => void
}) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const dipakai = new Set(pasangan.flatMap((p) => [p.a, p.b]))

  return (
    <div className="space-y-3">
      {pasangan.length > 0 && (
        <ul className="space-y-2">
          {pasangan.map((p, i) => (
            <li key={i} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
              <Avatar nama={anggota.find((m) => m.id === p.a)?.name ?? '?'} ukuran={28} />
              <Avatar nama={anggota.find((m) => m.id === p.b)?.name ?? '?'} ukuran={28} />
              <span className="flex-1 truncate text-sm text-slate-100">
                {anggota.find((m) => m.id === p.a)?.name} / {anggota.find((m) => m.id === p.b)?.name}
              </span>
              <Tombol kecil variasi="hantu" onClick={() => onHapus(i)}>
                Hapus
              </Tombol>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Kolom label="Pemain 1">
          <select
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-slate-100"
          >
            <option value="">Pilih…</option>
            {anggota
              .filter((m) => !dipakai.has(m.id) || m.id === a)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </Kolom>
        <Kolom label="Pemain 2">
          <select
            value={b}
            onChange={(e) => setB(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-slate-100"
          >
            <option value="">Pilih…</option>
            {anggota
              .filter((m) => m.id !== a && (!dipakai.has(m.id) || m.id === b))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </Kolom>
        <div className="flex items-end">
          <Tombol
            variasi="sekunder"
            onClick={() => {
              if (!a || !b || a === b) return
              onTambah(a, b)
              setA('')
              setB('')
            }}
            disabled={!a || !b || a === b}
          >
            + Pasangan
          </Tombol>
        </div>
      </div>
    </div>
  )
}
