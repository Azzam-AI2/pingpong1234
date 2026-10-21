import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { Input, Kartu, Kolom, Konfirmasi, Kosong, Modal, Segmen, Tombol } from '../components/ui'
import { KnockoutView } from '../components/KnockoutView'
import { AmericanoView } from '../components/AmericanoView'
import { LigaView } from '../components/LigaView'
import { LangkahBerikutnya } from '../components/Panduan'
import { lencanaStatus } from './Turnamen'
import type { BestOf, KnockoutFormat, TargetPoints, Tournament } from '../lib/types'
import { formatTanggal } from '../lib/utils'
import { keHash, type Target } from '../lib/router'

export default function TurnamenDetail({
  id,
  pindah,
}: {
  id: string
  pindah: (target: Target) => void
}) {
  const { snapshot, ubahTurnamen, hapusTurnamen, setStatus, sibuk, pesan } = useApp()

  const turnamen = snapshot.tournaments.find((t) => t.id === id)

  const jumlahMatch = useMemo(() => {
    if (!turnamen) return 0
    return turnamen.type === 'knockout'
      ? snapshot.knockout_matches.filter((m) => m.tournament_id === turnamen.id).length
      : snapshot.americano_matches.filter((m) => m.tournament_id === turnamen.id).length
  }, [snapshot, turnamen])

  const adaJadwal = jumlahMatch > 0

  const progres = useMemo(() => {
    if (!turnamen) return { total: 0, terisi: 0 }
    if (turnamen.type === 'knockout') {
      const main = snapshot.knockout_matches.filter(
        (m) => m.tournament_id === turnamen.id && m.participant_a && m.participant_b,
      )
      return { total: main.length, terisi: main.filter((m) => m.games.length > 0).length }
    }
    if (turnamen.type === 'americano') {
      const ms = snapshot.americano_matches.filter((m) => m.tournament_id === turnamen.id)
      return {
        total: ms.length,
        terisi: ms.filter((m) => m.score_a !== null && m.score_b !== null).length,
      }
    }
    const ms = snapshot.league_matches.filter((m) => m.tournament_id === turnamen.id)
    return {
      total: ms.length,
      terisi: ms.filter((m) => m.score_a !== null && m.score_b !== null).length,
    }
  }, [snapshot, turnamen])

  const [modalEdit, setModalEdit] = useState<{
    name: string
    date: string
    date_end: string
    format: KnockoutFormat
    best_of: BestOf
    target_points: TargetPoints
    match_duration_min: string
    rounds_planned: string
  } | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)

  if (!turnamen) {
    return (
      <Kosong
        judul="Turnamen tidak ditemukan"
        pesan="Turnamen ini mungkin sudah dihapus atau tautannya salah."
        aksi={
          <a href={keHash({ halaman: 'pilih-klub' })}>
            <Tombol>Kembali ke daftar klub</Tombol>
          </a>
        }
      />
    )
  }

  const simpanEdit = async () => {
    if (!modalEdit) return
    if (!modalEdit.name.trim()) {
      setGalat('Nama turnamen wajib diisi.')
      return
    }
    if (!modalEdit.date) {
      setGalat('Tanggal wajib diisi.')
      return
    }
    const durasi = modalEdit.match_duration_min.trim() === '' ? null : Number(modalEdit.match_duration_min)
    if (durasi !== null && (!Number.isInteger(durasi) || durasi < 1 || durasi > 120)) {
      setGalat('Durasi harus 1-120 menit atau kosong.')
      return
    }
    if (turnamen.type === 'liga') {
      if (!modalEdit.date_end) {
        setGalat('Tanggal selesai liga wajib diisi.')
        return
      }
      if (modalEdit.date_end < modalEdit.date) {
        setGalat('Tanggal selesai tidak boleh sebelum tanggal mulai.')
        return
      }
    }
    const ronde = modalEdit.rounds_planned.trim() === '' ? null : Number(modalEdit.rounds_planned)
    if (ronde !== null && (!Number.isInteger(ronde) || ronde < 1 || ronde > 60)) {
      setGalat('Jumlah ronde harus 1-60 atau kosong.')
      return
    }
    setGalat(null)
    const patch: Partial<Tournament> = { name: modalEdit.name.trim(), date: modalEdit.date }
    if (turnamen.type === 'knockout' && !adaJadwal) {
      patch.format = modalEdit.format
      patch.best_of = modalEdit.best_of
    }
    if (turnamen.type === 'americano' && !adaJadwal) {
      patch.target_points = modalEdit.target_points
      patch.match_duration_min = durasi
    }
    if (turnamen.type === 'liga') {
      patch.date_end = modalEdit.date_end
      if (!adaJadwal) {
        patch.format = modalEdit.format
        patch.target_points = 11
        patch.rounds_planned = ronde
      }
    }
    const ok = await ubahTurnamen(turnamen.id, patch)
    if (ok) setModalEdit(null)
  }

  return (
    <div className="space-y-4">
      <a
        href={keHash({ halaman: 'turnamen', klubId: turnamen.club_id })}
        className="inline-block text-sm text-ink-muted hover:text-ink-soft"
      >
        ← Semua turnamen
      </a>

      <Kartu className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-ink">{turnamen.name}</h1>
            <p className="text-sm text-ink-muted">
              {turnamen.type === 'knockout'
                ? `${formatTanggal(turnamen.date)} · Knockout ${
                    turnamen.format === 'double' ? 'Double' : 'Single'
                  } · Best of ${turnamen.best_of}`
                : turnamen.type === 'americano'
                  ? `${formatTanggal(turnamen.date)} · Americano · target ${turnamen.target_points} poin${
                      turnamen.match_duration_min ? ` · ${turnamen.match_duration_min} menit` : ''
                    }`
                  : `${formatTanggal(turnamen.date)} – ${formatTanggal(turnamen.date_end)} · Liga ${
                      turnamen.format === 'double' ? 'Double' : 'Single'
                    } · target ${turnamen.target_points} poin`}
            </p>
          </div>
          {lencanaStatus(turnamen.status)}
        </div>

        <div className="flex flex-wrap gap-2">
          <Tombol
            kecil
            variasi="sekunder"
            onClick={() => {
              setGalat(null)
              setModalEdit({
                name: turnamen.name,
                date: turnamen.date,
                date_end: turnamen.date_end ?? turnamen.date,
                format: turnamen.format ?? 'single',
                best_of: turnamen.best_of ?? 3,
                target_points: turnamen.target_points ?? 21,
                match_duration_min: turnamen.match_duration_min
                  ? String(turnamen.match_duration_min)
                  : '',
                rounds_planned: turnamen.rounds_planned ? String(turnamen.rounds_planned) : '',
              })
            }}
          >
            Edit info
          </Tombol>

          {turnamen.status === 'ongoing' && (
            <Tombol
              kecil
              variasi="sukses"
              disabled={sibuk}
              onClick={async () => {
                const ok = await setStatus(turnamen, 'finished')
                if (ok) pesan('Turnamen ditandai selesai.', 'sukses')
              }}
            >
              Tandai selesai
            </Tombol>
          )}

          {turnamen.status === 'finished' && (
            <Tombol
              kecil
              variasi="sekunder"
              disabled={sibuk}
              onClick={() => setStatus(turnamen, 'ongoing')}
            >
              Buka kembali
            </Tombol>
          )}

          <Tombol kecil variasi="bahaya" onClick={() => setKonfirmasiHapus(true)}>
            Hapus turnamen
          </Tombol>
        </div>
      </Kartu>

      {turnamen.status !== 'finished' && (
        <LangkahBerikutnya
          isi={
            progres.total === 0 ? (
              turnamen.type === 'knockout' ? (
                <>
                  Belum ada pertandingan. Pilih peserta di bawah, lalu tekan <b>🎲 Undi bracket acak</b>.
                </>
              ) : turnamen.type === 'americano' ? (
                <>
                  Belum ada jadwal. Pilih pemain di bawah, lalu tekan{' '}
                  <b>🎲 Buat jadwal rotasi pasangan</b>.
                </>
              ) : (
                <>
                  Belum ada jadwal. Pilih peserta di bawah, lalu tekan <b>📅 Buat jadwal liga</b>.
                </>
              )
            ) : (
              <>
                Skor terisi <b>{progres.terisi}</b> dari <b>{progres.total}</b> pertandingan.{' '}
                {progres.total - progres.terisi > 0
                  ? 'Ketuk kartu pertandingan di bawah untuk mengisi skornya.'
                  : 'Tandai turnamen selesai kalau sudah tidak ada pertandingan lagi.'}
              </>
            )
          }
        />
      )}

      {turnamen.status === 'finished' && (
        <LangkahBerikutnya
          judul="Turnamen selesai"
          isi={
            <>
              Juara sudah ditentukan{progres.total > 0 ? ` dari ${progres.total} pertandingan` : ''}. Lihat
              statistik dan gelar pemain klub di Leaderboard.
            </>
          }
          teksTombol="Buka leaderboard"
          tautan={keHash({ halaman: 'leaderboard', klubId: turnamen.club_id })}
        />
      )}

      {turnamen.type === 'knockout' ? (
        <KnockoutView turnamen={turnamen} />
      ) : turnamen.type === 'americano' ? (
        <AmericanoView turnamen={turnamen} />
      ) : (
        <LigaView turnamen={turnamen} />
      )}

      <Modal
        judul="Edit info turnamen"
        terbuka={modalEdit !== null}
        onTutup={() => setModalEdit(null)}
        aksi={
          <>
            <Tombol variasi="sekunder" onClick={() => setModalEdit(null)}>
              Batal
            </Tombol>
            <Tombol onClick={simpanEdit} disabled={sibuk}>
              Simpan
            </Tombol>
          </>
        }
      >
        <Kolom label="Nama turnamen" wajib>
          <Input
            value={modalEdit?.name ?? ''}
            onChange={(e) => modalEdit && setModalEdit({ ...modalEdit, name: e.target.value })}
            maxLength={80}
          />
        </Kolom>
        <Kolom label={turnamen.type === 'liga' ? 'Tanggal mulai' : 'Tanggal'} wajib>
          <Input
            type="date"
            value={modalEdit?.date ?? ''}
            onChange={(e) => modalEdit && setModalEdit({ ...modalEdit, date: e.target.value })}
          />
        </Kolom>

        {turnamen.type === 'liga' && (
          <Kolom label="Tanggal selesai" wajib>
            <Input
              type="date"
              value={modalEdit?.date_end ?? ''}
              onChange={(e) => modalEdit && setModalEdit({ ...modalEdit, date_end: e.target.value })}
            />
          </Kolom>
        )}

        {adaJadwal ? (
          <p className="rounded-xl border border-ink/12 bg-ink/6 p-3 text-xs text-ink-muted">
            Format{ turnamen.type === 'liga' ? ', target poin, dan jumlah ronde' : ', jumlah game, dan target poin' } tidak bisa diubah karena jadwal/pertandingan sudah dibuat.
            {turnamen.type === 'knockout'
              ? ' Pakai "Undi ulang bracket" kalau ingin mengubah susunan peserta.'
              : turnamen.type === 'americano'
                ? ' Pakai "Acak ulang jadwal" kalau ingin mengganti daftar pemain.'
                : ' Pakai "Acak ulang jadwal" di halaman liga kalau ingin mengganti peserta atau jumlah ronde.'}
          </p>
        ) : turnamen.type === 'knockout' ? (
          <>
            <Kolom label="Format peserta" wajib>
              <Segmen<KnockoutFormat>
                nilai={modalEdit?.format ?? 'single'}
                opsi={[
                  { nilai: 'single', label: 'Single' },
                  { nilai: 'double', label: 'Double' },
                ]}
                onPilih={(v) => modalEdit && setModalEdit({ ...modalEdit, format: v })}
              />
            </Kolom>
            <Kolom label="Best of" wajib>
              <Segmen<BestOf>
                nilai={modalEdit?.best_of ?? 3}
                opsi={[
                  { nilai: 3, label: 'Best of 3' },
                  { nilai: 5, label: 'Best of 5' },
                ]}
                onPilih={(v) => modalEdit && setModalEdit({ ...modalEdit, best_of: v })}
              />
            </Kolom>
          </>
        ) : turnamen.type === 'americano' ? (
          <>
            <Kolom label="Target poin" wajib>
              <Segmen<TargetPoints>
                nilai={modalEdit?.target_points ?? 21}
                opsi={[
                  { nilai: 11, label: '11' },
                  { nilai: 15, label: '15' },
                  { nilai: 21, label: '21' },
                  { nilai: 24, label: '24' },
                ]}
                onPilih={(v) => modalEdit && setModalEdit({ ...modalEdit, target_points: v })}
              />
            </Kolom>
            <Kolom label="Durasi pertandingan (menit)" petunjuk="Opsional, 1-120 menit.">
              <Input
                inputMode="numeric"
                value={modalEdit?.match_duration_min ?? ''}
                onChange={(e) =>
                  modalEdit &&
                  setModalEdit({ ...modalEdit, match_duration_min: e.target.value.replace(/[^0-9]/g, '') })
                }
                placeholder="mis. 10"
              />
            </Kolom>
          </>
        ) : (
          <>
            <Kolom label="Format peserta" wajib>
              <Segmen<KnockoutFormat>
                nilai={modalEdit?.format ?? 'single'}
                opsi={[
                  { nilai: 'single', label: 'Single' },
                  { nilai: 'double', label: 'Double' },
                ]}
                onPilih={(v) => modalEdit && setModalEdit({ ...modalEdit, format: v })}
              />
            </Kolom>
            <p className="rounded-xl border border-ink/12 bg-ink/6 p-2.5 text-xs text-ink-soft">
              Skor liga tetap dimainkan sampai <b>11 poin</b> per pertandingan.
            </p>
            <Kolom
              label="Jumlah ronde"
              petunjuk="Kosongkan = semua peserta bertemu sekali."
            >
              <Input
                inputMode="numeric"
                value={modalEdit?.rounds_planned ?? ''}
                onChange={(e) =>
                  modalEdit &&
                  setModalEdit({ ...modalEdit, rounds_planned: e.target.value.replace(/[^0-9]/g, '') })
                }
                placeholder="otomatis"
              />
            </Kolom>
          </>
        )}

        {galat && <p className="text-sm text-rose-700">{galat}</p>}
      </Modal>

      <Konfirmasi
        terbuka={konfirmasiHapus}
        judul="Hapus turnamen ini?"
        pesan={
          <>
            Turnamen <b>{turnamen.name}</b> beserta {jumlahMatch} pertandingan dan seluruh skornya akan dihapus
            permanen.
          </>
        }
        teksYa="Hapus turnamen"
        onBatal={() => setKonfirmasiHapus(false)}
        onYa={async () => {
          setKonfirmasiHapus(false)
          const ok = await hapusTurnamen(turnamen.id)
          if (ok) pindah({ halaman: 'turnamen', klubId: turnamen.club_id })
        }}
      />
    </div>
  )
}
