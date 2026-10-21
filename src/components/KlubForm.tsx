import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { Input, InputGambar, Kolom, Modal, Tombol } from './ui'
import { validasiNama } from '../lib/utils'

export interface DataKlubForm {
  id?: string
  name: string
  logo_url: string | null
}

/**
 * Modal buat/edit klub. Dipakai bersama oleh halaman daftar klub dan halaman klub
 * supaya validasi (nama wajib, nama tidak boleh kembar) hanya ditulis sekali.
 * `data === null` berarti modal tertutup.
 */
export function ModalKlub({
  data,
  onTutup,
  onSimpan,
}: {
  data: DataKlubForm | null
  onTutup: () => void
  onSimpan?: (id: string | null, baruDibuat: boolean) => void
}) {
  const { snapshot, simpanKlub, sibuk } = useApp()
  const [form, setForm] = useState<DataKlubForm | null>(data)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    setForm(data)
    setGalat(null)
  }, [data])

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
    const baruDibuat = !form.id
    const id = await simpanKlub(form)
    if (id) {
      onTutup()
      onSimpan?.(id, baruDibuat)
    }
  }

  return (
    <Modal
      judul={form?.id ? 'Edit klub' : 'Klub baru'}
      terbuka={form !== null}
      onTutup={onTutup}
      aksi={
        <>
          <Tombol variasi="sekunder" onClick={onTutup}>
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
      {galat && <p className="text-sm text-rose-700">{galat}</p>}
    </Modal>
  )
}
