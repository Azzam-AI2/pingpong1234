import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import {
  Avatar,
  Input,
  InputGambar,
  Kartu,
  Kolom,
  Konfirmasi,
  Kosong,
  Lencana,
  Modal,
  Segmen,
  Tombol,
} from '../components/ui'
import type { Gender } from '../lib/types'
import { validasiNama } from '../lib/utils'

interface FormKlub {
  id?: string
  name: string
  logo_url: string | null
}

interface FormAnggota {
  id?: string
  name: string
  gender: Gender
  photo_url: string | null
}

const FORM_ANGGOTA_KOSONG: FormAnggota = { name: '', gender: 'L', photo_url: null }

export default function Klub() {
  const {
    snapshot,
    klubAktif,
    pilihKlub,
    simpanKlub,
    hapusKlub,
    simpanAnggota,
    hapusAnggota,
    pemakaianAnggota,
    sibuk,
  } = useApp()

  const [modalKlub, setModalKlub] = useState<FormKlub | null>(null)
  const [modalAnggota, setModalAnggota] = useState<FormAnggota | null>(null)
  const [konfirmasiKlub, setKonfirmasiKlub] = useState<string | null>(null)
  const [konfirmasiAnggota, setKonfirmasiAnggota] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  const anggota = useMemo(
    () =>
      snapshot.members
        .filter((m) => m.club_id === klubAktif?.id)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.members, klubAktif],
  )

  const jumlahAnggota = (clubId: string) => snapshot.members.filter((m) => m.club_id === clubId).length
  const jumlahTurnamen = (clubId: string) => snapshot.tournaments.filter((t) => t.club_id === clubId).length

  const simpanFormKlub = async () => {
    if (!modalKlub) return
    const salah = validasiNama(modalKlub.name)
    if (salah) {
      setGalat(salah)
      return
    }
    setGalat(null)
    const ok = await simpanKlub(modalKlub)
    if (ok) setModalKlub(null)
  }

  const simpanFormAnggota = async () => {
    if (!modalAnggota || !klubAktif) return
    const salah = validasiNama(modalAnggota.name)
    if (salah) {
      setGalat(salah)
      return
    }
    const namaSama = snapshot.members.some(
      (m) =>
        m.club_id === klubAktif.id &&
        m.id !== modalAnggota.id &&
        m.name.trim().toLowerCase() === modalAnggota.name.trim().toLowerCase(),
    )
    if (namaSama) {
      setGalat('Sudah ada anggota dengan nama itu di klub ini.')
      return
    }
    setGalat(null)
    const ok = await simpanAnggota({ ...modalAnggota, club_id: klubAktif.id })
    if (ok) setModalAnggota(null)
  }

  const anggotaTerpilih = snapshot.members.find((m) => m.id === konfirmasiAnggota)
  const dipakai = konfirmasiAnggota ? pemakaianAnggota(konfirmasiAnggota) : []

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- klub */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-slate-100">Klub</h1>
          <Tombol
            onClick={() => {
              setGalat(null)
              setModalKlub({ name: '', logo_url: null })
            }}
          >
            + Tambah klub
          </Tombol>
        </div>

        {snapshot.clubs.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {snapshot.clubs.map((c) => (
              <Kartu key={c.id} className={c.id === klubAktif?.id ? 'ring-1 ring-brand-400/40' : ''}>
                <div className="flex items-start gap-3">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/25 text-xl">
                      🏓
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-slate-100">{c.name}</p>
                      {c.id === klubAktif?.id && <Lencana warna="biru">Aktif</Lencana>}
                    </div>
                    <p className="text-xs text-slate-400">
                      {jumlahAnggota(c.id)} anggota · {jumlahTurnamen(c.id)} turnamen
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.id !== klubAktif?.id && (
                    <Tombol kecil variasi="sekunder" onClick={() => pilihKlub(c.id)}>
                      Jadikan aktif
                    </Tombol>
                  )}
                  <Tombol
                    kecil
                    variasi="sekunder"
                    onClick={() => {
                      setGalat(null)
                      setModalKlub({ id: c.id, name: c.name, logo_url: c.logo_url })
                    }}
                  >
                    Edit
                  </Tombol>
                  <Tombol kecil variasi="bahaya" onClick={() => setKonfirmasiKlub(c.id)}>
                    Hapus
                  </Tombol>
                </div>
              </Kartu>
            ))}
          </div>
        ) : (
          <Kosong
            judul="Belum ada klub"
            pesan="Klub adalah wadah anggota dan turnamen. Buat minimal satu klub untuk mulai."
            aksi={
              <Tombol onClick={() => setModalKlub({ name: '', logo_url: null })}>Tambah klub</Tombol>
            }
          />
        )}
      </section>

      {/* ---------------------------------------------------------- anggota */}
      {klubAktif && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">
              Anggota <span className="text-sm font-normal text-slate-400">· {klubAktif.name}</span>
            </h2>
            <Tombol
              onClick={() => {
                setGalat(null)
                setModalAnggota({ ...FORM_ANGGOTA_KOSONG })
              }}
            >
              + Tambah anggota
            </Tombol>
          </div>

          {anggota.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {anggota.map((m) => {
                const pakai = pemakaianAnggota(m.id)
                return (
                  <Kartu key={m.id}>
                    <div className="flex items-center gap-3">
                      <Avatar nama={m.name} src={m.photo_url} ukuran={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-100">{m.name}</p>
                        <p className="text-xs text-slate-400">
                          {m.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                          {pakai.length > 0 && ` · ${pakai.length} turnamen`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Tombol
                        kecil
                        variasi="sekunder"
                        onClick={() => {
                          setGalat(null)
                          setModalAnggota({
                            id: m.id,
                            name: m.name,
                            gender: m.gender,
                            photo_url: m.photo_url,
                          })
                        }}
                      >
                        Edit
                      </Tombol>
                      <Tombol kecil variasi="bahaya" onClick={() => setKonfirmasiAnggota(m.id)}>
                        Hapus
                      </Tombol>
                    </div>
                  </Kartu>
                )
              })}
            </div>
          ) : (
            <Kosong
              judul="Belum ada anggota"
              pesan="Tambahkan anggota klub supaya bisa mendaftarkan peserta turnamen."
              aksi={
                <Tombol onClick={() => setModalAnggota({ ...FORM_ANGGOTA_KOSONG })}>Tambah anggota</Tombol>
              }
            />
          )}
        </section>
      )}

      {/* ------------------------------------------------------------ modal */}
      <Modal
        judul={modalKlub?.id ? 'Edit klub' : 'Tambah klub'}
        terbuka={modalKlub !== null}
        onTutup={() => setModalKlub(null)}
        aksi={
          <>
            <Tombol variasi="sekunder" onClick={() => setModalKlub(null)}>
              Batal
            </Tombol>
            <Tombol onClick={simpanFormKlub} disabled={sibuk}>
              Simpan
            </Tombol>
          </>
        }
      >
        <Kolom label="Nama klub" wajib>
          <Input
            value={modalKlub?.name ?? ''}
            onChange={(e) => modalKlub && setModalKlub({ ...modalKlub, name: e.target.value })}
            placeholder="Contoh: Pingpong Club FinOps"
            maxLength={60}
          />
        </Kolom>
        <InputGambar
          label="Logo klub"
          nilai={modalKlub?.logo_url ?? null}
          onUbah={(v) => modalKlub && setModalKlub({ ...modalKlub, logo_url: v })}
        />
        {galat && <p className="text-sm text-rose-400">{galat}</p>}
      </Modal>

      <Modal
        judul={modalAnggota?.id ? 'Edit anggota' : 'Tambah anggota'}
        terbuka={modalAnggota !== null}
        onTutup={() => setModalAnggota(null)}
        aksi={
          <>
            <Tombol variasi="sekunder" onClick={() => setModalAnggota(null)}>
              Batal
            </Tombol>
            <Tombol onClick={simpanFormAnggota} disabled={sibuk}>
              Simpan
            </Tombol>
          </>
        }
      >
        <Kolom label="Nama anggota" wajib>
          <Input
            value={modalAnggota?.name ?? ''}
            onChange={(e) => modalAnggota && setModalAnggota({ ...modalAnggota, name: e.target.value })}
            placeholder="Nama lengkap atau panggilan"
            maxLength={60}
          />
        </Kolom>
        <Kolom label="Jenis kelamin" wajib>
          <Segmen<Gender>
            nilai={modalAnggota?.gender ?? 'L'}
            opsi={[
              { nilai: 'L', label: 'Laki-laki' },
              { nilai: 'P', label: 'Perempuan' },
            ]}
            onPilih={(v) => modalAnggota && setModalAnggota({ ...modalAnggota, gender: v })}
          />
        </Kolom>
        <InputGambar
          label="Foto anggota"
          nilai={modalAnggota?.photo_url ?? null}
          onUbah={(v) => modalAnggota && setModalAnggota({ ...modalAnggota, photo_url: v })}
        />
        {galat && <p className="text-sm text-rose-400">{galat}</p>}
      </Modal>

      <Konfirmasi
        terbuka={konfirmasiKlub !== null}
        judul="Hapus klub?"
        pesan={
          konfirmasiKlub ? (
            <>
              Klub <b>{snapshot.clubs.find((c) => c.id === konfirmasiKlub)?.name}</b> akan dihapus bersama{' '}
              <b>{jumlahAnggota(konfirmasiKlub)} anggota</b> dan <b>{jumlahTurnamen(konfirmasiKlub)} turnamen</b>{' '}
              beserta seluruh hasil pertandingannya. Tindakan ini tidak bisa dibatalkan.
            </>
          ) : (
            ''
          )
        }
        teksYa="Hapus klub & datanya"
        onBatal={() => setKonfirmasiKlub(null)}
        onYa={async () => {
          const id = konfirmasiKlub
          setKonfirmasiKlub(null)
          if (id) await hapusKlub(id)
        }}
      />

      <Konfirmasi
        terbuka={konfirmasiAnggota !== null}
        judul="Hapus anggota?"
        pesan={
          <>
            <p>
              Anggota <b>{anggotaTerpilih?.name}</b> akan dihapus dari klub.
            </p>
            {dipakai.length > 0 && (
              <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-2 text-amber-100">
                Perhatian: anggota ini terdaftar di {dipakai.length} turnamen ({dipakai.map((t) => t.name).join(', ')}).
                Riwayat hasil pertandingan tetap tersimpan, tetapi nama pemain pada bracket/jadwal tidak lagi
                terhubung ke profilnya.
              </p>
            )}
          </>
        }
        teksYa={dipakai.length ? 'Tetap hapus' : 'Hapus anggota'}
        onBatal={() => setKonfirmasiAnggota(null)}
        onYa={async () => {
          const id = konfirmasiAnggota
          setKonfirmasiAnggota(null)
          if (id) await hapusAnggota(id)
        }}
      />
    </div>
  )
}
