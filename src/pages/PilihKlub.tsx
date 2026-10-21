import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { Kartu, Konfirmasi, Kosong, Lencana, Tombol } from '../components/ui'
import { ModalKlub, type DataKlubForm } from '../components/KlubForm'
import { Petunjuk } from '../components/Panduan'
import { bersihkanAksi, keHash, type Target } from '../lib/router'
import { formatTanggal } from '../lib/utils'
import { pemenangTurnamen } from '../lib/knockout'
import { DaftarUndangan } from './Undangan'
import { PendaftarMasuk } from '../components/PendaftarMasuk'
import { bisaAturKlub, bisaKelola, keluar, klubSaya, labelPeran, modeOnline } from '../lib/auth'
import { pastikanAntrean } from '../lib/pendaftaran'

/**
 * Halaman awal aplikasi: daftar klub sebagai hierarki tertinggi.
 * Semua data (anggota, turnamen, leaderboard) berada di dalam klub.
 */
export default function PilihKlub({ aksi, pindah }: { aksi?: string; pindah: (t: Target) => void }) {
  const { snapshot, hapusKlub, klubTerakhir, muatUlang } = useApp()
  const [form, setForm] = useState<DataKlubForm | null>(null)
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null)
  const [peran, setPeran] = useState<Record<string, string>>({})
  const [peranSiap, setPeranSiap] = useState(false)
  const daring = modeOnline()

  // Peran dibaca dari database (RPC my_clubs), bukan dari tampilan, supaya
  // tombol yang muncul mengikuti izin yang benar-benar dimiliki pengguna.
  useEffect(() => {
    if (!daring) {
      setPeranSiap(true)
      return
    }
    let hidup = true
    void klubSaya().then((rows) => {
      if (!hidup) return
      setPeran(Object.fromEntries(rows.map((r) => [r.club_id, r.role])))
      setPeranSiap(true)
    })
    // Akun baru tanpa klub tetap dicatat di antrean penugasan (idempoten).
    void pastikanAntrean()
    return () => {
      hidup = false
    }
  }, [daring])

  const bolehAtur = (clubId: string) => !daring || bisaAturKlub(peran[clubId] ?? '')
  const bolehBuatKlub = !daring || Object.values(peran).some((r) => bisaAturKlub(r))

  useEffect(() => {
    if (aksi === 'baru-klub') {
      setForm({ name: '', logo_url: null })
      bersihkanAksi()
    }
  }, [aksi])

  const jumlahAnggota = (clubId: string) => snapshot.members.filter((m) => m.club_id === clubId).length
  const turnamenKlub = (clubId: string) => snapshot.tournaments.filter((t) => t.club_id === clubId)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-ink">Klub kamu</h1>
          <p className="text-sm text-ink-muted">
            Pilih klub untuk membuka anggota, turnamen, dan leaderboard-nya.
          </p>
        </div>
        {bolehBuatKlub && (
          <Tombol onClick={() => setForm({ name: '', logo_url: null })}>+ Klub baru</Tombol>
        )}
      </div>

      {daring && <DaftarUndangan onBerubah={() => void muatUlang()} />}

      {daring && peranSiap && Object.keys(peran).length === 0 && (
        <Kartu>
          <h2 className="text-base font-semibold text-ink">Akun kamu aktif, menunggu penugasan</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Pemilik klub belum menambahkanmu ke klub mana pun. Setelah ditugaskan, klubnya otomatis
            muncul di halaman ini.
          </p>
          <div className="mt-3">
            <Tombol variasi="sekunder" kecil onClick={() => void keluar()}>
              Keluar
            </Tombol>
          </div>
        </Kartu>
      )}

      <PendaftarMasuk
        klub={snapshot.clubs
          .filter((c) => bisaKelola(peran[c.id] ?? ''))
          .map((c) => ({ id: c.id, name: c.name, role: peran[c.id] ?? 'member' }))}
      />

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
                className={c.id === klubTerakhir?.id ? 'ring-1 ring-brand-600/40' : undefined}
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
                      <p className="truncate font-semibold text-ink">{c.name}</p>
                      {daring && peran[c.id] && (
                        <Lencana warna="hijau">{labelPeran(peran[c.id])}</Lencana>
                      )}
                      {c.id === klubTerakhir?.id && <Lencana warna="biru">terakhir dibuka</Lencana>}
                    </div>
                    <p className="text-xs text-ink-muted">
                      {jumlahAnggota(c.id)} anggota · {turnamen.length} turnamen ·{' '}
                      {turnamen.filter((t) => t.status === 'finished').length} selesai
                    </p>
                    {juara && (
                      <p className="mt-1 text-xs text-accent-900">
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
                  {bolehAtur(c.id) && (
                    <>
                      <Tombol
                        kecil
                        variasi="sekunder"
                        onClick={() => setForm({ id: c.id, name: c.name, logo_url: c.logo_url })}
                      >
                        Edit
                      </Tombol>
                      <Tombol kecil variasi="bahaya" onClick={() => setKonfirmasi(c.id)}>
                        Hapus
                      </Tombol>
                    </>
                  )}
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

      <ModalKlub
        data={form}
        onTutup={() => setForm(null)}
        onSimpan={(idKlub, baruDibuat) => {
          if (baruDibuat && idKlub) pindah({ halaman: 'beranda', klubId: idKlub })
        }}
      />

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
