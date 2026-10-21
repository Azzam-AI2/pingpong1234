import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { Input, Kartu, Kolom, Konfirmasi, Kosong, Lencana, Modal, Segmen, Tombol } from '../components/ui'
import { Petunjuk } from '../components/Panduan'
import { bersihkanAksi, keHash, type Target } from '../lib/router'
import type { BestOf, KnockoutFormat, TargetPoints, Tournament, TournamentStatus } from '../lib/types'
import { formatTanggal, todayISO, uid } from '../lib/utils'
import { pemenangTurnamen } from '../lib/knockout'
import { americanoStandings } from '../lib/americano'
import { hitungKlasemenLiga, juaraLiga } from '../lib/liga'
import { formatTersedia, profilOlahraga } from '../lib/sports'

interface FormTurnamen {
  name: string
  date: string
  date_end: string
  type: Tournament['type']
  format: KnockoutFormat
  best_of: BestOf
  target_points: TargetPoints
  match_duration_min: string
  rounds_planned: string
}

const FORM_AWAL: FormTurnamen = {
  name: '',
  date: todayISO(),
  date_end: todayISO(),
  type: 'knockout',
  format: 'single',
  best_of: 3,
  target_points: 21,
  match_duration_min: '',
  rounds_planned: '',
}

export function lencanaStatus(status: TournamentStatus) {
  if (status === 'draft') return <Lencana>Belum dimulai</Lencana>
  if (status === 'ongoing') return <Lencana warna="biru">Sedang berjalan</Lencana>
  return <Lencana warna="hijau">Selesai</Lencana>
}

export default function Turnamen({
  pindah,
  aksi,
}: {
  pindah: (target: Target) => void
  aksi?: string
}) {
  const { snapshot, klubAktif, simpanTurnamen, hapusTurnamen, sibuk, pesan } = useApp()
  const [form, setForm] = useState<FormTurnamen | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [filter, setFilter] = useState<'semua' | TournamentStatus>('semua')
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null)

  const daftar = useMemo(() => {
    if (!klubAktif) return []
    return snapshot.tournaments
      .filter((t) => t.club_id === klubAktif.id)
      .filter((t) => filter === 'semua' || t.status === filter)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [snapshot.tournaments, klubAktif, filter])

  const infoTurnamen = (t: Tournament) => {
    const peserta = snapshot.participants.filter((p) => p.tournament_id === t.id)
    const jumlahMatch =
      snapshot.knockout_matches.filter((m) => m.tournament_id === t.id).length +
      snapshot.americano_matches.filter((m) => m.tournament_id === t.id).length +
      snapshot.league_matches.filter((m) => m.tournament_id === t.id).length
    let juara: string | null = null
    if (t.status === 'finished') {
      if (t.type === 'knockout') {
        const ms = snapshot.knockout_matches.filter((m) => m.tournament_id === t.id)
        const id = pemenangTurnamen(ms, t.best_of ?? 3)
        juara = peserta.find((p) => p.id === id)?.label ?? null
      } else if (t.type === 'americano') {
        const ms = snapshot.americano_matches.filter((m) => m.tournament_id === t.id)
        const pemain = new Set<string>()
        for (const m of ms) for (const id of [...m.team_a, ...m.team_b]) pemain.add(id)
        const klasemen = americanoStandings([...pemain], ms)
        const juaraIds = klasemen.filter((k) => k.rank === 1 && k.matches > 0).map((k) => k.memberId)
        juara =
          juaraIds.map((id) => snapshot.members.find((m) => m.id === id)?.name ?? '?').join(' & ') ||
          null
      } else {
        const ms = snapshot.league_matches.filter((m) => m.tournament_id === t.id)
        const klasemen = hitungKlasemenLiga(
          peserta,
          ms,
          (id) => snapshot.members.find((m) => m.id === id)?.name ?? id,
        )
        juara = juaraLiga(klasemen.utama).map((k) => k.nama).join(' & ') || null
      }
    }
    return { peserta, jumlahMatch, juara }
  }

  // Tombol cepat dari Dashboard: #/turnamen?aksi=baru-turnamen
  useEffect(() => {
    if (aksi === 'baru-turnamen') {
      setGalat(null)
      setForm({ ...FORM_AWAL })
      bersihkanAksi()
    }
  }, [aksi])

  const kirim = async () => {
    if (!form || !klubAktif) return
    if (!form.name.trim()) {
      setGalat('Nama turnamen wajib diisi.')
      return
    }
    if (!form.date) {
      setGalat('Tanggal wajib diisi.')
      return
    }
    if (form.type === 'liga' && !form.date_end) {
      setGalat('Tanggal selesai liga wajib diisi.')
      return
    }
    if (form.type === 'liga' && form.date_end < form.date) {
      setGalat('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }
    const durasi = form.match_duration_min.trim() === '' ? null : Number(form.match_duration_min)
    if (durasi !== null && (!Number.isInteger(durasi) || durasi < 1 || durasi > 120)) {
      setGalat('Durasi pertandingan harus 1-120 menit (atau kosongkan).')
      return
    }
    const ronde = form.rounds_planned.trim() === '' ? null : Number(form.rounds_planned)
    if (ronde !== null && (!Number.isInteger(ronde) || ronde < 1 || ronde > 60)) {
      setGalat('Jumlah ronde harus 1-60 (atau kosongkan untuk semua peserta bertemu sekali).')
      return
    }
    setGalat(null)
    const id = uid()
    const ok = await simpanTurnamen({
      id,
      club_id: klubAktif.id,
      name: form.name,
      date: form.date,
      type: form.type,
      format: form.type === 'americano' ? null : form.format,
      best_of: form.type === 'knockout' ? form.best_of : null,
      target_points: form.type === 'americano' ? form.target_points : form.type === 'liga' ? 11 : null,
      match_duration_min: form.type === 'americano' ? durasi : null,
      date_end: form.type === 'liga' ? form.date_end : null,
      rounds_planned: form.type === 'liga' ? ronde : null,
    })
    if (ok) {
      setForm(null)
      pindah({ halaman: 'detail', klubId: klubAktif.id, id })
    }
  }

  if (!klubAktif) {
    return (
      <Kosong
        judul="Klub tidak dipilih"
        pesan="Buka salah satu klub dari daftar klub untuk melihat turnamennya."
        aksi={
          <a href={keHash({ halaman: 'pilih-klub' })}>
            <Tombol>Pilih klub</Tombol>
          </a>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-ink">
          Turnamen <span className="text-sm font-normal text-ink-muted">· {klubAktif.name}</span>
        </h1>
        <Tombol
          onClick={() => {
            setGalat(null)
            setForm({ ...FORM_AWAL })
          }}
        >
          + Turnamen baru
        </Tombol>
      </div>

      <Petunjuk id="turnamen-jenis" judul="Bingung pilih jenis turnamen?">
        <p>
          <b>Knockout</b> — sistem gugur, kalah sekali langsung keluar. Paling cepat, cocok untuk satu
          hari.
        </p>
        <p>
          <b>Americano</b> — pasangan dirotasi tiap ronde, semua orang main banyak, peringkat dihitung
          dari poin individu.
        </p>
        <p>
          <b>Liga</b> — semua peserta saling bertemu dan mengumpulkan poin sepanjang liga; juara =
          total poin tertinggi.
        </p>
      </Petunjuk>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['semua', 'Semua'],
            ['draft', 'Draft'],
            ['ongoing', 'Berlangsung'],
            ['finished', 'Selesai'],
          ] as const
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            type="button"
            onClick={() => setFilter(nilai)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              filter === nilai ? 'bg-brand-600 text-white' : 'bg-ink/6 text-ink-soft hover:bg-ink/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {daftar.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {daftar.map((t) => {
            const info = infoTurnamen(t)
            return (
              <Kartu key={t.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{t.name}</p>
                    <p className="text-xs text-ink-muted">
                      {t.type === 'liga'
                        ? `${formatTanggal(t.date)} – ${formatTanggal(t.date_end)}`
                        : formatTanggal(t.date)}
                    </p>
                  </div>
                  {lencanaStatus(t.status)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Lencana
                    warna={t.type === 'knockout' ? 'biru' : t.type === 'americano' ? 'kuning' : 'merah'}
                  >
                    {t.type === 'knockout' ? 'Knockout' : t.type === 'americano' ? 'Americano' : 'Liga'}
                  </Lencana>
                  {t.type === 'knockout' && (
                    <>
                      <Lencana>{t.format === 'double' ? 'Double' : 'Single'}</Lencana>
                      <Lencana>Best of {t.best_of}</Lencana>
                    </>
                  )}
                  {t.type === 'americano' && (
                    <>
                      <Lencana>Target {t.target_points} poin</Lencana>
                      {t.match_duration_min && <Lencana>{t.match_duration_min} menit</Lencana>}
                    </>
                  )}
                  {t.type === 'liga' && (
                    <>
                      <Lencana>{t.format === 'double' ? 'Double' : 'Single'}</Lencana>
                      <Lencana>Target {t.target_points} poin</Lencana>
                      {t.rounds_planned && <Lencana>{t.rounds_planned} ronde</Lencana>}
                    </>
                  )}
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  {info.peserta.length} peserta · {info.jumlahMatch} pertandingan
                </p>
                {info.juara && (
                  <p className="mt-1 text-sm text-accent-900">🏆 Juara: {info.juara}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Tombol kecil onClick={() => pindah({ halaman: 'detail', klubId: t.club_id, id: t.id })}>
                    Buka
                  </Tombol>
                  <Tombol kecil variasi="bahaya" onClick={() => setKonfirmasi(t.id)}>
                    Hapus
                  </Tombol>
                </div>
              </Kartu>
            )
          })}
        </div>
      ) : (
        <Kosong
          judul="Belum ada turnamen"
          pesan="Buat turnamen knockout (sistem gugur) atau Americano (rotasi pasangan dengan poin individu)."
          aksi={
            <Tombol onClick={() => setForm({ ...FORM_AWAL })}>Buat turnamen</Tombol>
          }
        />
      )}

      <Modal
        judul="Turnamen baru"
        terbuka={form !== null}
        onTutup={() => setForm(null)}
        aksi={
          <>
            <Tombol variasi="sekunder" onClick={() => setForm(null)}>
              Batal
            </Tombol>
            <Tombol onClick={kirim} disabled={sibuk}>
              Buat turnamen
            </Tombol>
          </>
        }
      >
        <Kolom label="Nama turnamen" wajib>
          <Input
            value={form?.name ?? ''}
            onChange={(e) => form && setForm({ ...form, name: e.target.value })}
            placeholder="Contoh: Turnamen Internal Oktober"
            maxLength={80}
          />
        </Kolom>
        <Kolom label={form?.type === 'liga' ? 'Tanggal mulai' : 'Tanggal'} wajib>
          <Input
            type="date"
            value={form?.date ?? ''}
            onChange={(e) => form && setForm({ ...form, date: e.target.value })}
          />
        </Kolom>
        <Kolom label="Jenis turnamen" wajib>
          <Segmen
            nilai={form?.type ?? 'knockout'}
            opsi={formatTersedia(klubAktif?.sport_slug).map((f) => ({
              nilai: f,
              label: f === 'knockout' ? 'Knockout' : f === 'liga' ? 'Liga' : 'Americano',
            }))}
            onPilih={(v) => form && setForm({ ...form, type: v })}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Cabang {profilOlahraga(klubAktif?.sport_slug).nama}:{' '}
            {profilOlahraga(klubAktif?.sport_slug).keterangan}
          </p>
        </Kolom>

        <p className="rounded-xl border border-ink/12 bg-ink/6 p-2.5 text-xs text-ink-soft">
          {form?.type === 'americano'
            ? 'Pasangan dirotasi setiap ronde. Peringkat dihitung dari total poin individu, bukan jumlah kemenangan.'
            : form?.type === 'liga'
              ? 'Semua peserta saling bertemu (round-robin). Juara = total poin tertinggi; menang tidak menentukan peringkat.'
              : 'Sistem gugur: kalah sekali langsung keluar. Bye dibuat otomatis kalau jumlah peserta bukan pangkat dua.'}
        </p>

        {form === null ? null : form.type === 'knockout' ? (
          <>
            <Kolom label="Format peserta" wajib>
              <Segmen<KnockoutFormat>
                nilai={form.format}
                opsi={[
                  { nilai: 'single', label: 'Single' },
                  { nilai: 'double', label: 'Double' },
                ]}
                onPilih={(v) => setForm({ ...form, format: v })}
              />
            </Kolom>
            <Kolom
              label={
                profilOlahraga(klubAktif?.sport_slug).aturan('knockout').jenis === 'set'
                  ? 'Jumlah set (best of)'
                  : 'Best of'
              }
              wajib
            >
              <Segmen<BestOf>
                nilai={form.best_of}
                opsi={[
                  { nilai: 3, label: 'Best of 3' },
                  { nilai: 5, label: 'Best of 5' },
                ]}
                onPilih={(v) => setForm({ ...form, best_of: v })}
              />
            </Kolom>
          </>
        ) : form.type === 'americano' ? (
          <>
            <Kolom label="Target poin per pertandingan" wajib>
              <Segmen<TargetPoints>
                nilai={form.target_points}
                opsi={[
                  { nilai: 11, label: '11' },
                  { nilai: 15, label: '15' },
                  { nilai: 21, label: '21' },
                  { nilai: 24, label: '24' },
                ]}
                onPilih={(v) => setForm({ ...form, target_points: v })}
              />
            </Kolom>
            <Kolom label="Durasi pertandingan (menit)" petunjuk="Opsional. Kalau diisi, muncul timer di tiap ronde.">
              <Input
                inputMode="numeric"
                value={form.match_duration_min}
                onChange={(e) =>
                  setForm({ ...form, match_duration_min: e.target.value.replace(/[^0-9]/g, '') })
                }
                placeholder="mis. 10"
              />
            </Kolom>
          </>
        ) : (
          <>
            <Kolom label="Tanggal selesai" wajib petunjuk="Rentang pelaksanaan liga.">
              <Input
                type="date"
                value={form.date_end}
                onChange={(e) => setForm({ ...form, date_end: e.target.value })}
              />
            </Kolom>
            <Kolom label="Format peserta" wajib>
              <Segmen<KnockoutFormat>
                nilai={form.format}
                opsi={[
                  { nilai: 'single', label: 'Single' },
                  { nilai: 'double', label: 'Double' },
                ]}
                onPilih={(v) => setForm({ ...form, format: v })}
              />
            </Kolom>
            <p className="rounded-xl border border-ink/12 bg-ink/6 p-2.5 text-xs text-ink-soft">
              Skor tiap pertandingan liga mengikuti aturan cabang klub (pingpong 11 poin tanpa deuce; bulu tangkis 21 poin, unggul 2);
              tidak ada pilihan target lain. Poin yang dicetak dijumlahkan sepanjang liga.
            </p>
            <Kolom
              label="Jumlah ronde"
              petunjuk="Kosongkan = semua peserta bertemu sekali (jumlah ronde dihitung otomatis)."
            >
              <Input
                inputMode="numeric"
                value={form.rounds_planned}
                onChange={(e) =>
                  setForm({ ...form, rounds_planned: e.target.value.replace(/[^0-9]/g, '') })
                }
                placeholder="otomatis"
              />
            </Kolom>
          </>
        )}

        {galat && <p className="text-sm text-rose-700">{galat}</p>}
      </Modal>

      <Konfirmasi
        terbuka={konfirmasi !== null}
        judul="Hapus turnamen?"
        pesan={
          konfirmasi ? (
            <>
              Turnamen <b>{snapshot.tournaments.find((t) => t.id === konfirmasi)?.name}</b> beserta peserta,
              jadwal, dan seluruh hasil pertandingannya akan dihapus permanen.
            </>
          ) : (
            ''
          )
        }
        teksYa="Hapus turnamen"
        onBatal={() => setKonfirmasi(null)}
        onYa={async () => {
          const id = konfirmasi
          setKonfirmasi(null)
          if (!id) return
          const ok = await hapusTurnamen(id)
          if (ok) pesan('Turnamen dihapus.', 'sukses')
        }}
      />
    </div>
  )
}
