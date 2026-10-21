import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import {
  Avatar,
  Input,
  InputGambar,
  Kartu,
  Kolom,
  Konfirmasi,
  Kosong,
  Modal,
  Segmen,
  Tombol,
} from '../components/ui'
import { Petunjuk } from '../components/Panduan'
import { bersihkanAksi } from '../lib/router'
import type { Gender } from '../lib/types'
import { validasiNama } from '../lib/utils'

interface FormAnggota {
  id?: string
  name: string
  gender: Gender
  photo_url: string | null
}

const FORM_KOSONG: FormAnggota = { name: '', gender: 'L', photo_url: null }

/** Halaman anggota untuk klub yang sedang dibuka. */
export default function Anggota({ aksi }: { aksi?: string }) {
  const { snapshot, klubAktif, simpanAnggota, hapusAnggota, pemakaianAnggota, sibuk } = useApp()

  const [form, setForm] = useState<FormAnggota | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null)

  const anggota = useMemo(
    () =>
      snapshot.members
        .filter((m) => m.club_id === klubAktif?.id)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.members, klubAktif],
  )

  useEffect(() => {
    if (aksi === 'baru-anggota' && klubAktif) {
      setGalat(null)
      setForm({ ...FORM_KOSONG })
      bersihkanAksi()
    }
  }, [aksi, klubAktif])

  const kirim = async () => {
    if (!form || !klubAktif) return
    const salah = validasiNama(form.name)
    if (salah) {
      setGalat(salah)
      return
    }
    const namaSama = snapshot.members.some(
      (m) =>
        m.club_id === klubAktif.id &&
        m.id !== form.id &&
        m.name.trim().toLowerCase() === form.name.trim().toLowerCase(),
    )
    if (namaSama) {
      setGalat('Sudah ada anggota dengan nama itu di klub ini.')
      return
    }
    setGalat(null)
    const ok = await simpanAnggota({ ...form, club_id: klubAktif.id })
    if (ok) setForm(null)
  }

  const terpilih = snapshot.members.find((m) => m.id === konfirmasi)
  const dipakai = konfirmasi ? pemakaianAnggota(konfirmasi) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-ink">Anggota</h1>
          <p className="text-sm text-ink-muted">
            {anggota.length} orang di {klubAktif?.name ?? 'klub ini'}
          </p>
        </div>
        <Tombol
          onClick={() => {
            setGalat(null)
            setForm({ ...FORM_KOSONG })
          }}
        >
          + Tambah anggota
        </Tombol>
      </div>

      <Petunjuk id="anggota-dasar" judul="Yang perlu kamu tahu">
        <p>
          Anggota di sini yang dipakai sebagai peserta turnamen. Minimal 2 orang untuk Knockout; untuk
          Americano sebaiknya 4 orang atau lebih.
        </p>
        <p>
          Menghapus anggota yang sudah dipakai turnamen tetap boleh, tapi akan muncul peringatan dulu
          karena namanya masih tercatat di bracket/jadwal.
        </p>
      </Petunjuk>

      {anggota.length === 0 ? (
        <Kosong
          judul="Belum ada anggota"
          pesan="Tambahkan anggota klub supaya bisa mendaftarkan peserta turnamen."
          aksi={<Tombol onClick={() => setForm({ ...FORM_KOSONG })}>Tambah anggota</Tombol>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {anggota.map((m) => {
            const pakai = pemakaianAnggota(m.id)
            return (
              <Kartu key={m.id}>
                <div className="flex items-center gap-3">
                  <Avatar nama={m.name} src={m.photo_url} ukuran={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{m.name}</p>
                    <p className="text-xs text-ink-muted">
                      {m.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                      {pakai.length > 0 && ` · ikut ${pakai.length} turnamen`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Tombol
                    kecil
                    variasi="sekunder"
                    onClick={() => {
                      setGalat(null)
                      setForm({
                        id: m.id,
                        name: m.name,
                        gender: m.gender,
                        photo_url: m.photo_url,
                      })
                    }}
                  >
                    Edit
                  </Tombol>
                  <Tombol kecil variasi="bahaya" onClick={() => setKonfirmasi(m.id)}>
                    Hapus
                  </Tombol>
                </div>
              </Kartu>
            )
          })}
        </div>
      )}

      <Modal
        judul={form?.id ? 'Edit anggota' : 'Tambah anggota'}
        terbuka={form !== null}
        onTutup={() => setForm(null)}
        aksi={
          <>
            <Tombol variasi="sekunder" onClick={() => setForm(null)}>
              Batal
            </Tombol>
            <Tombol onClick={kirim} disabled={sibuk}>
              Simpan
            </Tombol>
          </>
        }
      >
        <Kolom label="Nama anggota" wajib>
          <Input
            value={form?.name ?? ''}
            onChange={(e) => form && setForm({ ...form, name: e.target.value })}
            placeholder="Nama lengkap atau panggilan"
            maxLength={60}
          />
        </Kolom>
        <Kolom label="Jenis kelamin" wajib>
          <Segmen<Gender>
            nilai={form?.gender ?? 'L'}
            opsi={[
              { nilai: 'L', label: 'Laki-laki' },
              { nilai: 'P', label: 'Perempuan' },
            ]}
            onPilih={(v) => form && setForm({ ...form, gender: v })}
          />
        </Kolom>
        <InputGambar
          label="Foto anggota"
          nilai={form?.photo_url ?? null}
          onUbah={(v) => form && setForm({ ...form, photo_url: v })}
        />
        {galat && <p className="text-sm text-rose-700">{galat}</p>}
      </Modal>

      <Konfirmasi
        terbuka={konfirmasi !== null}
        judul="Hapus anggota?"
        pesan={
          <>
            <p>
              Anggota <b>{terpilih?.name}</b> akan dihapus dari klub.
            </p>
            {dipakai.length > 0 && (
              <p className="mt-2 rounded-xl border border-accent-500/30 bg-accent-500/10 p-2 text-accent-900">
                Perhatian: anggota ini terdaftar di {dipakai.length} turnamen (
                {dipakai.map((t) => t.name).join(', ')}). Riwayat hasil pertandingan tetap tersimpan,
                tetapi nama pemain pada bracket/jadwal tidak lagi terhubung ke profilnya.
              </p>
            )}
          </>
        }
        teksYa={dipakai.length ? 'Tetap hapus' : 'Hapus anggota'}
        onBatal={() => setKonfirmasi(null)}
        onYa={async () => {
          const id = konfirmasi
          setKonfirmasi(null)
          if (id) await hapusAnggota(id)
        }}
      />
    </div>
  )
}
