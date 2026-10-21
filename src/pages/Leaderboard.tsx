import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { Avatar, Kartu, Kosong, Lencana, Modal, Segmen, Tombol } from '../components/ui'
import { urutkanStatistik, type StatAnggota, type UrutStat } from '../lib/stats'
import { formatTanggal } from '../lib/utils'
import { keHash } from '../lib/router'

type Tampilan = 'knockout' | 'americano' | 'gabungan'

/** Leaderboard klub: statistik pemain lintas turnamen di klub ini. */
export default function Leaderboard() {
  const { statistik, klubAktif } = useApp()
  const [tampilan, setTampilan] = useState<Tampilan>('knockout')
  const [urut, setUrut] = useState<UrutStat>('gelar')
  const [detail, setDetail] = useState<StatAnggota | null>(null)

  const urutan = useMemo(
    () => urutkanStatistik(statistik, tampilan === 'americano' ? 'poin' : urut),
    [statistik, urut, tampilan],
  )

  if (!klubAktif) return null

  const adaData = urutan.some(
    (s) => s.knockout.matches > 0 || s.americano.matches > 0 || s.knockout.riwayat.length > 0,
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-ink">Leaderboard</h1>
          <p className="text-sm text-ink-muted">
            Statistik pemain {klubAktif.name}, dihitung dari turnamen yang sudah dimainkan.
          </p>
        </div>
        {tampilan !== 'americano' && (
          <select
            value={urut}
            onChange={(e) => setUrut(e.target.value as UrutStat)}
            className="rounded-xl border border-ink/12 bg-surface-2 px-3 py-2 text-sm text-ink"
          >
            <option value="gelar">Urut: gelar juara</option>
            <option value="winrate">Urut: win rate</option>
            <option value="pertandingan">Urut: jumlah pertandingan</option>
          </select>
        )}
      </div>

      <Segmen<Tampilan>
        nilai={tampilan}
        opsi={[
          { nilai: 'knockout', label: 'Knockout' },
          { nilai: 'americano', label: 'Americano' },
          { nilai: 'gabungan', label: 'Gabungan' },
        ]}
        onPilih={setTampilan}
      />

      {!adaData ? (
        <Kosong
          judul="Belum ada statistik"
          pesan="Statistik muncul otomatis setelah ada pertandingan yang dimainkan dan skornya diisi."
          aksi={
            <a href={keHash({ halaman: 'turnamen', klubId: klubAktif.id, aksi: 'baru-turnamen' })}>
              <Tombol>Buat turnamen</Tombol>
            </a>
          }
        />
      ) : (
        <Kartu className="space-y-3">
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Pemain</th>
                  {tampilan === 'knockout' && (
                    <>
                      <th className="px-2 py-2 text-right">Main</th>
                      <th className="px-2 py-2 text-right">M</th>
                      <th className="px-2 py-2 text-right">K</th>
                      <th className="px-2 py-2 text-right">Win rate</th>
                    </>
                  )}
                  {tampilan === 'americano' && (
                    <>
                      <th className="px-2 py-2 text-right">Main</th>
                      <th className="px-2 py-2 text-right">M</th>
                      <th className="px-2 py-2 text-right">K</th>
                      <th className="px-2 py-2 text-right">Poin</th>
                    </>
                  )}
                  {tampilan === 'gabungan' && (
                    <>
                      <th className="px-2 py-2 text-right">Total main</th>
                      <th className="px-2 py-2 text-right">Win rate KO</th>
                      <th className="px-2 py-2 text-right">Poin AM</th>
                    </>
                  )}
                  <th className="px-2 py-2 text-right">Gelar</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {urutan.map((s, i) => {
                  const gelar =
                    tampilan === 'knockout'
                      ? s.knockout.titles
                      : tampilan === 'americano'
                        ? s.americano.titles
                        : s.knockout.titles + s.americano.titles
                  return (
                    <tr key={s.memberId} className="border-t border-ink/8">
                      <td className="px-2 py-2 text-ink-muted">{i + 1}</td>
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2">
                          <Avatar nama={s.nama} src={s.photo_url} ukuran={28} />
                          <span className="truncate text-ink">{s.nama}</span>
                          {gelar > 0 && <Lencana warna="kuning">🏅{gelar}</Lencana>}
                        </span>
                      </td>
                      {tampilan === 'knockout' && (
                        <>
                          <td className="px-2 py-2 text-right text-ink-soft">{s.knockout.matches}</td>
                          <td className="px-2 py-2 text-right text-emerald-800">{s.knockout.wins}</td>
                          <td className="px-2 py-2 text-right text-rose-700">{s.knockout.losses}</td>
                          <td className="px-2 py-2 text-right text-ink">{s.knockout.winrate}%</td>
                        </>
                      )}
                      {tampilan === 'americano' && (
                        <>
                          <td className="px-2 py-2 text-right text-ink-soft">{s.americano.matches}</td>
                          <td className="px-2 py-2 text-right text-emerald-800">{s.americano.wins}</td>
                          <td className="px-2 py-2 text-right text-rose-700">{s.americano.losses}</td>
                          <td className="px-2 py-2 text-right font-semibold text-ink">
                            {s.americano.poin}
                          </td>
                        </>
                      )}
                      {tampilan === 'gabungan' && (
                        <>
                          <td className="px-2 py-2 text-right text-ink-soft">
                            {s.knockout.matches + s.americano.matches}
                          </td>
                          <td className="px-2 py-2 text-right text-ink">{s.knockout.winrate}%</td>
                          <td className="px-2 py-2 text-right text-ink">{s.americano.poin}</td>
                        </>
                      )}
                      <td className="px-2 py-2 text-right text-accent-900">{gelar}</td>
                      <td className="px-2 py-2 text-right">
                        <Tombol kecil variasi="sekunder" onClick={() => setDetail(s)}>
                          Riwayat
                        </Tombol>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-muted">
            Statistik knockout dan Americano dihitung terpisah — poin Americano tidak pernah dihitung
            sebagai kemenangan knockout.
          </p>
        </Kartu>
      )}

      <Modal
        judul={detail ? `Riwayat · ${detail.nama}` : 'Riwayat'}
        terbuka={detail !== null}
        onTutup={() => setDetail(null)}
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-ink/12 bg-ink/6 p-3">
                <p className="text-xs text-ink-muted">Knockout</p>
                <p className="text-sm text-ink">
                  {detail.knockout.matches} main · {detail.knockout.wins}M/{detail.knockout.losses}K ·{' '}
                  {detail.knockout.winrate}%
                </p>
                <p className="text-xs text-accent-900">🏅 {detail.knockout.titles} gelar</p>
              </div>
              <div className="rounded-xl border border-ink/12 bg-ink/6 p-3">
                <p className="text-xs text-ink-muted">Americano</p>
                <p className="text-sm text-ink">
                  {detail.americano.matches} main · {detail.americano.poin} poin
                </p>
                <p className="text-xs text-accent-900">🏅 {detail.americano.titles} gelar</p>
              </div>
            </div>

            {[...detail.knockout.riwayat, ...detail.americano.riwayat].length === 0 ? (
              <p className="text-sm text-ink-muted">Belum ada riwayat turnamen.</p>
            ) : (
              <ul className="space-y-2">
                {[...detail.knockout.riwayat, ...detail.americano.riwayat]
                  .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))
                  .map((r) => (
                    <li
                      key={`${r.jenis}-${r.tournamentId}`}
                      className="rounded-xl border border-ink/12 bg-ink/[0.04] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">{r.nama}</span>
                        <span className="flex items-center gap-1.5">
                          <Lencana warna={r.jenis === 'Knockout' ? 'biru' : 'kuning'}>{r.jenis}</Lencana>
                          {r.pencapaian === 'Juara' ? (
                            <Lencana warna="kuning">🏆 Juara</Lencana>
                          ) : r.pencapaian === 'Runner-up' ? (
                            <Lencana warna="hijau">Runner-up</Lencana>
                          ) : (
                            <Lencana>{r.pencapaian}</Lencana>
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {formatTanggal(r.tanggal)} · {r.catatan}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
