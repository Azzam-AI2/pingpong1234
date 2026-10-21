import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import {
  Avatar,
  Input,
  InputGambar,
  Kolom,
  Konfirmasi,
  Kosong,
  Modal,
  Pilih,
  Segmen,
  Tombol,
} from '../components/ui'
import { Ikon } from '../components/Ikon'
import { bersihkanAksi } from '../lib/router'
import { anggotaAktif, saringAnggota, type StatusAnggota, type UrutAnggota } from '../lib/anggota'
import type { Gender, Member } from '../lib/types'
import { formatTanggal, validasiNama } from '../lib/utils'

interface FormAnggota {
  id?: string
  name: string
  gender: Gender
  photo_url: string | null
  aktif: boolean
  duplikat?: boolean
}

const FORM_KOSONG: FormAnggota = { name: '', gender: 'L', photo_url: null, aktif: true }

/** Tombol aksi baris: ikon kecil dengan area ketuk nyaman. */
function TombolIkon({
  judul,
  nama,
  onClick,
  bahaya,
}: {
  judul: string
  nama: 'pensil' | 'salin' | 'sampah'
  onClick: () => void
  bahaya?: boolean
}) {
  return (
    <button
      type="button"
      title={judul}
      aria-label={judul}
      onClick={onClick}
      className={
        'rounded-lg p-1.5 transition-colors hover:bg-ink/10 ' +
        (bahaya ? 'text-rose-700' : 'text-ink-muted hover:text-ink')
      }
    >
      <Ikon nama={nama} kelas="h-[18px] w-[18px]" />
    </button>
  )
}

/** Daftar anggota klub: pencarian, filter, dan aksi per baris. */
export default function Anggota({ aksi }: { aksi?: string }) {
  const { snapshot, klubAktif, simpanAnggota, hapusAnggota, pemakaianAnggota, sibuk } = useApp()

  const [form, setForm] = useState<FormAnggota | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null)
  const [cari, setCari] = useState('')
  const [gender, setGender] = useState<'semua' | Gender>('semua')
  const [status, setStatus] = useState<StatusAnggota>('semua')
  const [urut, setUrut] = useState<UrutAnggota>('nama-az')

  const semua = useMemo(
    () => snapshot.members.filter((m) => m.club_id === klubAktif?.id),
    [snapshot.members, klubAktif],
  )
  const tampil = useMemo(
    () => saringAnggota(semua, { cari, gender, status, urut }),
    [semua, cari, gender, status, urut],
  )
  const jumlahAktif = semua.filter(anggotaAktif).length
  const adaSaringan = cari.trim() !== '' || gender !== 'semua' || status !== 'semua' || urut !== 'nama-az'

  useEffect(() => {
    if (aksi === 'baru-anggota' && klubAktif) {
      setGalat(null)
      setForm({ ...FORM_KOSONG })
      bersihkanAksi()
    }
  }, [aksi, klubAktif])

  const bukaTambah = () => {
    setGalat(null)
    setForm({ ...FORM_KOSONG })
  }

  const bukaEdit = (m: Member) => {
    setGalat(null)
    setForm({
      id: m.id,
      name: m.name,
      gender: m.gender,
      photo_url: m.photo_url,
      aktif: anggotaAktif(m),
    })
  }

  const bukaDuplikat = (m: Member) => {
    setGalat(null)
    setForm({
      name: m.name,
      gender: m.gender,
      photo_url: m.photo_url,
      aktif: anggotaAktif(m),
      duplikat: true,
    })
  }

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
    const ok = await simpanAnggota({
      id: form.id,
      club_id: klubAktif.id,
      name: form.name,
      gender: form.gender,
      photo_url: form.photo_url,
      aktif: form.aktif,
    })
    if (ok) setForm(null)
  }

  const terpilih = snapshot.members.find((m) => m.id === konfirmasi)
  const dipakai = konfirmasi ? pemakaianAnggota(konfirmasi) : []
  const resetSaringan = () => {
    setCari('')
    setGender('semua')
    setStatus('semua')
    setUrut('nama-az')
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Anggota</h1>
          <p className="mt-1.5 text-sm text-ink-muted sm:text-base">
            {semua.length} anggota · {jumlahAktif} aktif
          </p>
        </div>
        <Tombol onClick={bukaTambah}>+ Tambah anggota</Tombol>
      </section>

      {semua.length > 0 && (
        <section className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
              <Ikon nama="cari" kelas="h-[18px] w-[18px]" />
            </span>
            <Input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama..."
              className="pl-10"
              aria-label="Cari anggota"
            />
          </div>

          <div className="relative">
            <Pilih
              value={gender}
              onChange={(e) => setGender(e.target.value as 'semua' | Gender)}
              aria-label="Saring jenis kelamin"
              className="pr-9"
            >
              <option value="semua">Semua gender</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Pilih>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint">
              <Ikon nama="chevron" kelas="h-4 w-4" />
            </span>
          </div>

          <div className="relative">
            <Pilih
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusAnggota)}
              aria-label="Saring status"
              className="pr-9"
            >
              <option value="semua">Semua status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </Pilih>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint">
              <Ikon nama="chevron" kelas="h-4 w-4" />
            </span>
          </div>

          <div className="relative">
            <Pilih
              value={urut}
              onChange={(e) => setUrut(e.target.value as UrutAnggota)}
              aria-label="Urutkan anggota"
              className="pr-9"
            >
              <option value="nama-az">Nama A–Z</option>
              <option value="nama-za">Nama Z–A</option>
              <option value="terbaru">Terbaru</option>
              <option value="terlama">Terlama</option>
            </Pilih>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint">
              <Ikon nama="chevron" kelas="h-4 w-4" />
            </span>
          </div>
        </section>
      )}

      {semua.length === 0 ? (
        <Kosong
          judul="Belum ada anggota"
          pesan="Tambahkan anggota klub supaya bisa mendaftarkan peserta turnamen. Minimal 2 orang untuk Knockout; untuk Americano atau Liga sebaiknya 4 orang atau lebih."
          aksi={<Tombol onClick={bukaTambah}>Tambah anggota</Tombol>}
        />
      ) : tampil.length === 0 ? (
        <div className="rounded-2xl border border-ink/12 bg-surface p-6 text-center">
          <p className="text-sm text-ink-muted">Tidak ada anggota yang cocok dengan saringan ini.</p>
          <div className="mt-3 flex justify-center">
            <Tombol variasi="sekunder" onClick={resetSaringan}>
              Reset saringan
            </Tombol>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/12 bg-surface shadow-ink/5 shadow-sm">
          {tampil.map((m) => {
            const aktif = anggotaAktif(m)
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <Avatar nama={m.name} src={m.photo_url} ukuran={40} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{m.name}</p>
                  <p className="truncate text-[13px] text-ink-muted">
                    {m.gender === 'L' ? 'Laki-laki' : 'Perempuan'} · Terdaftar{' '}
                    {formatTanggal(m.created_at)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
                  <span
                    className={
                      'rounded-full px-2.5 py-1 text-xs font-semibold ' +
                      (aktif ? 'bg-brand-600 text-white' : 'bg-ink/10 text-ink-soft')
                    }
                  >
                    {aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <TombolIkon judul="Edit anggota" nama="pensil" onClick={() => bukaEdit(m)} />
                  <TombolIkon judul="Duplikat anggota" nama="salin" onClick={() => bukaDuplikat(m)} />
                  <TombolIkon
                    judul="Hapus anggota"
                    nama="sampah"
                    bahaya
                    onClick={() => setKonfirmasi(m.id)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {adaSaringan && tampil.length > 0 && (
        <p className="text-xs text-ink-muted">
          Menampilkan {tampil.length} dari {semua.length} anggota.{' '}
          <button type="button" className="underline hover:text-ink" onClick={resetSaringan}>
            Reset saringan
          </button>
        </p>
      )}

      <Modal
        judul={form?.id ? 'Edit anggota' : form?.duplikat ? 'Duplikat anggota' : 'Tambah anggota'}
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
        <Kolom label="Status keanggotaan" petunjuk="Nonaktif = masih tersimpan, tapi tidak ikut dihitung sebagai anggota aktif.">
          <Segmen<'aktif' | 'nonaktif'>
            nilai={form?.aktif === false ? 'nonaktif' : 'aktif'}
            opsi={[
              { nilai: 'aktif', label: 'Aktif' },
              { nilai: 'nonaktif', label: 'Nonaktif' },
            ]}
            onPilih={(v) => form && setForm({ ...form, aktif: v === 'aktif' })}
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
            <p className="mt-2 text-xs text-ink-muted">
              Kalau kamu hanya ingin mengeluarkannya dari daftar aktif, pakai status{' '}
              <b>Nonaktif</b> lewat tombol edit.
            </p>
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
