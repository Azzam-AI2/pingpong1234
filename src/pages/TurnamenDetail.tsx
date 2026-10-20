import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { Input, Kartu, Kolom, Konfirmasi, Kosong, Modal, Segmen, Tombol } from '../components/ui'
import { KnockoutView } from '../components/KnockoutView'
import { AmericanoView } from '../components/AmericanoView'
import { lencanaStatus } from './Turnamen'
import type { BestOf, KnockoutFormat, TargetPoints, Tournament } from '../lib/types'
import { formatTanggal } from '../lib/utils'
import { keHash, type NamaHalaman } from '../lib/router'

export default function TurnamenDetail({
  id,
  pindah,
}: {
  id: string
  pindah: (h: NamaHalaman, id?: string) => void
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

  const [modalEdit, setModalEdit] = useState<{
    name: string
    date: string
    format: KnockoutFormat
    best_of: BestOf
    target_points: TargetPoints
    match_duration_min: string
  } | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)

  if (!turnamen) {
    return (
      <Kosong
        judul="Turnamen tidak ditemukan"
        pesan="Turnamen ini mungkin sudah dihapus atau tautannya salah."
        aksi={
          <a href={keHash('turnamen')}>
            <Tombol>Kembali ke daftar turnamen</Tombol>
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
    const ok = await ubahTurnamen(turnamen.id, patch)
    if (ok) setModalEdit(null)
  }

  return (
    <div className="space-y-4">
      <a href={keHash('turnamen')} className="inline-block text-sm text-slate-400 hover:text-slate-200">
        ← Semua turnamen
      </a>

      <Kartu className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-100">{turnamen.name}</h1>
            <p className="text-sm text-slate-400">
              {formatTanggal(turnamen.date)} ·{' '}
              {turnamen.type === 'knockout'
                ? `Knockout ${turnamen.format === 'double' ? 'Double' : 'Single'} · Best of ${turnamen.best_of}`
                : `Americano · target ${turnamen.target_points} poin${
                    turnamen.match_duration_min ? ` · ${turnamen.match_duration_min} menit` : ''
                  }`}
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
                format: turnamen.format ?? 'single',
                best_of: turnamen.best_of ?? 3,
                target_points: turnamen.target_points ?? 21,
                match_duration_min: turnamen.match_duration_min ? String(turnamen.match_duration_min) : '',
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

      {turnamen.type === 'knockout' ? (
        <KnockoutView turnamen={turnamen} />
      ) : (
        <AmericanoView turnamen={turnamen} />
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
        <Kolom label="Tanggal" wajib>
          <Input
            type="date"
            value={modalEdit?.date ?? ''}
            onChange={(e) => modalEdit && setModalEdit({ ...modalEdit, date: e.target.value })}
          />
        </Kolom>

        {adaJadwal ? (
          <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
            Format, jumlah game, dan target poin tidak bisa diubah karena jadwal/pertandingan sudah dibuat.
            {turnamen.type === 'knockout'
              ? ' Pakai "Undi ulang bracket" kalau ingin mengubah susunan peserta.'
              : ' Pakai "Acak ulang jadwal" kalau ingin mengganti daftar pemain.'}
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
        ) : (
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
        )}

        {galat && <p className="text-sm text-rose-400">{galat}</p>}
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
          if (ok) pindah('turnamen')
        }}
      />
    </div>
  )
}
