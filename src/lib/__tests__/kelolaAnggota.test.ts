import { describe, expect, it } from 'vitest'
import {
  bolehKelolaPeran,
  labelStatusAnggota,
  opsiPeran,
  rencanakanTautan,
  tombolPeranNonaktif,
} from '../kelolaAnggota'

describe('opsi peran di UI mengikuti aturan database', () => {
  it('pemilik klub boleh memberi semua peran', () => {
    expect(opsiPeran('owner')).toEqual(['owner', 'admin', 'official', 'member'])
    expect(opsiPeran('org_owner')).toEqual(['owner', 'admin', 'official', 'member'])
  })

  it('selain pemilik hanya boleh memberi official/member', () => {
    expect(opsiPeran('admin')).toEqual(['official', 'member'])
    expect(opsiPeran('member')).toEqual(['official', 'member'])
    expect(opsiPeran('')).toEqual(['official', 'member'])
  })
})

describe('penautan anggota ke akun (hibrida)', () => {
  const akun = [
    {
      user_id: 'u-1',
      email: 'budi@contoh.com',
      nama: 'Budi',
      role: 'member',
      status: 'active',
      joined_at: null,
    },
  ]

  it('email cocok -> akun ditautkan', () => {
    const r = rencanakanTautan(akun, [], 'Budi@Contoh.com ')
    expect(r.user_id).toBe('u-1')
    expect(r.perluUndang).toBeFalsy()
    expect(r.galat).toBeUndefined()
  })

  it('email belum punya akun -> perlu undangan', () => {
    const r = rencanakanTautan(akun, [], 'baru@contoh.com')
    expect(r.perluUndang).toBe(true)
    expect(r.user_id).toBeUndefined()
  })

  it('akun sudah tertaut ke anggota lain -> ditolak', () => {
    const r = rencanakanTautan(akun, [{ id: 'm-1', user_id: 'u-1' }], 'budi@contoh.com', 'm-2')
    expect(r.galat).toContain('sudah tertaut')
  })

  it('anggota yang sama saat edit tidak dianggap bentrok', () => {
    const r = rencanakanTautan(akun, [{ id: 'm-1', user_id: 'u-1' }], 'budi@contoh.com', 'm-1')
    expect(r.user_id).toBe('u-1')
    expect(r.galat).toBeUndefined()
  })

  it('email kosong -> tidak mengubah tautan', () => {
    expect(rencanakanTautan(akun, [{ id: 'm-1', user_id: 'u-1' }], '   ')).toEqual({})
  })
})

describe('label status anggota', () => {
  it('ramah dibaca', () => {
    expect(labelStatusAnggota('active')).toBe('Aktif')
    expect(labelStatusAnggota('suspended')).toBe('Ditangguhkan')
    expect(labelStatusAnggota('left')).toBe('Keluar')
    expect(labelStatusAnggota('invited')).toBe('Diundang')
    expect(labelStatusAnggota('aneh')).toBe('aneh')
  })
})

describe('siapa boleh mengubah peran', () => {
  it('hanya owner/org_owner', () => {
    expect(bolehKelolaPeran('owner')).toBe(true)
    expect(bolehKelolaPeran('org_owner')).toBe(true)
    expect(bolehKelolaPeran('admin')).toBe(false)
    expect(bolehKelolaPeran('official')).toBe(false)
    expect(bolehKelolaPeran(null)).toBe(false)
  })
})

describe('pengaman owner terakhir', () => {
  it('tombol dinonaktifkan untuk owner aktif terakhir', () => {
    expect(tombolPeranNonaktif('owner', 'active', 1)).toBe(true)
    expect(tombolPeranNonaktif('owner', 'active', 2)).toBe(false)
    expect(tombolPeranNonaktif('admin', 'active', 1)).toBe(false)
    expect(tombolPeranNonaktif('owner', 'suspended', 1)).toBe(false)
  })
})
