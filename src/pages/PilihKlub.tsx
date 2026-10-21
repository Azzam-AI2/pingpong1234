import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import {
  Input,
  InputGambar,
  Kartu,
  Kolom,
  Konfirmasi,
  Kosong,
  Lencana,
  Modal,
  Tombol,
} from '../components/ui'
import { Petunjuk } from '../components/Panduan'
import { bersihkanAksi, keHash, type Target } from '../lib/router'
import { formatTanggal, validasiNama } from '../lib/utils'
import { pemenangTurnamen } from '../lib/knockout'

interface FormKlub {
  id?: string
  name: string
  logo_url: string | null
}

/**
 * Halaman awal aplikasi: daftar klub sebagai hierarki tertinggi.
 * Semua data (anggota, turnamen, leaderboard) berada di dalam klub.
 */
export default function PilihKlub({ aksi, pindah }: { aksi?: string; pindah: (t: Target) => void }) {
  const { snapshot, simpanKlub, hapusKlub, klubTerakhir, sibuk } = useApp()
  const [form, setForm] = useState<FormKlub | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null)

  useEffect(() => {
    if (aksi === 'baru-klub') {
      setGalat(null)
      setForm({ name: '', logo_url: null })
      bersihkanAksi()
    }
  }, [aksi])

  const kirim = async () => {
    if (!form) return
    const salah = validasiNama(form.name)
    if (salah) {
      setGalat(salah)
      return
    }
    const namaSama = snapshot.clubs.some(
      (c) => c.id !== form.id && c.name.trim().toLowerCase() === form.name.trim().toLowerCase(),
    )
    if (namaSama) {
      setGalat('Sudah ada klub dengan nama itu. Pakai nama lain agar tidak tertukar.')
      return
    }
    setGalat(null)
    const idKlub = await simpanKlub(form)
    if (idKlub) {
      setForm(null)
      pindah({ halaman: 'beranda', klubId: idKlub })
    }
  }

  const jumlahAnggota = (clubId: string) => snapshot.members.filter((m) => m.club_id === clubId).length
  const turnamenKlub = (clubId: string) => snapshot.tournaments.filter((t) => t.club_id === clubId)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Klub kamu</h1>
          <p className="text-sm text-slate-400">
            Pilih klub untuk membuka anggota, turnamen, dan leaderboard-nya.
          </p>
        </div>
        <Tombol
          onClick={() => {
            setGalat(null)
            setForm({ name: '', logo_url: null })
          }}
        >
          + Klub baru
        </Tombol>
      </div>

      {snapshot.clubs.length === 0 ? (
        <>
          <Kosong
            judul="Belum ada klub"
            pesan="Klub adalah wadah tertinggi: di dalamnya ada anggota, turnamen, dan leaderboard. Buat satu klub dulu, ya."
            aksi={
              <Tombol onClick={() => setForm({ name: '', logo_url: null })}>Buat klub pertama</Tombol>
            }
          />
          <Petunjuk id="pilih-klub-dasar" judul="Urutan pemakaian">
            <p>
              1) Buat klub → 2) tambah anggota (minimal 2 orang) → 3) buat turnamen Knockout atau
              Americano → 4) isi skor tiap pertandingan. Juara dan leaderboard dihitung otomatis.
            </p>
          </Petunjuk>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {snapshot.clubs.map((c) => {
            const turnamen = turnamenKlub(c.id)
            const juara = turnamen
              .filter((t) => t.status === 'finished')
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
            let namaJuara: string | null = null
            if (juara && juara.type === 'knockout') {
              const ms = snapshot.knockout_matches.filter((m) => m.tournament_id === juara.id)
              const pid = pemenangTurnamen(ms, juara.best_of ?? 3)
              namaJuara = snapshot.participants.find((p) => p.id === pid)?.label ?? null
            }

            return (
              <Kartu
                key={c.id}
                className={c.id === klubTerakhir?.id ? 'ring-1 ring-brand-400/40' : undefined}
              >
                <div className="flex items-start gap-3">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600/25 text-2xl">
                      🏓
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-slate-100">{c.name}</p>
                      {c.id === klubTerakhir?.id && <Lencana warna="biru">terakhir dibuka</Lencana>}
                    </div>
                    <p className="text-xs text-slate-400">
                      {jumlahAnggota(c.id)} anggota · {turnamen.length} turnamen ·{' '}
                      {turnamen.filter((t) => t.status === 'finished').length} selesai
                    </p>
                    {juara && (
                      <p className="mt-1 text-xs text-amber-200">
                        🏆 {namaJuara ? `${namaJuara} · ` : ''}
                        {juara.name} ({formatTanggal(juara.date)})
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={keHash({ halaman: 'beranda', klubId: c.id })}>
                    <Tombol kecil>Masuk klub</Tombol>
                  </a>
                  <Tombol
                    kecil
                    variasi="sekunder"
                    onClick={() => {
                      setGalat(null)
                      setForm({ id: c.id, name: c.name, logo_url: c.logo_url })
                    }}
                  >
                    Edit
                  </Tombol>
                  <Tombol kecil variasi="bahaya" onClick={() => setKonfirmasi(c.id)}>
                    Hapus
                  </Tombol>
                </div>
              </Kartu>
            )
          })}
        </div>
      )}

      <Petunjuk id="pilih-klub-info" judul="Klub sebagai hierarki tertinggi">
        <p>
          Semua data melekat pada klub: anggota, turnamen, jadwal, skor, dan leaderboard. Kalau kamu
          mengelola beberapa komunitas (mis. kantor dan komunitas malam), buat klub terpisah supaya
          datanya tidak tercampur.
        </p>
      </Petunjuk>

      <Modal
        judul={form?.id ? 'Edit klub' : 'Klub baru'}
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
        <Kolom label="Nama klub" wajib>
          <Input
            value={form?.name ?? ''}
            onChange={(e) => form && setForm({ ...form, name: e.target.value })}
            placeholder="Contoh: Pingpong Club FinOps"
            maxLength={60}
          />
        </Kolom>
        <InputGambar
          label="Logo klub"
          nilai={form?.logo_url ?? null}
          onUbah={(v) => form && setForm({ ...form, logo_url: v })}
        />
        {galat && <p className="text-sm text-rose-400">{galat}</p>}
      </Modal>

      <Konfirmasi
        terbuka={konfirmasi !== null}
        judul="Hapus klub?"
        pesan={
          konfirmasi ? (
            <>
              Klub <b>{snapshot.clubs.find((c) => c.id === konfirmasi)?.name}</b> akan dihapus bersama{' '}
              <b>{jumlahAnggota(konfirmasi)} anggota</b> dan <b>{turnamenKlub(konfirmasi).length} turnamen</b>{' '}
              beserta seluruh hasil pertandingannya. Tindakan ini tidak bisa dibatalkan.
            </>
          ) : (
            ''
          )
        }
        teksYa="Hapus klub & datanya"
        onBatal={() => setKonfirmasi(null)}
        onYa={async () => {
          const id = konfirmasi
          setKonfirmasi(null)
          if (id) await hapusKlub(id)
        }}
      />
    </div>
  )
}
