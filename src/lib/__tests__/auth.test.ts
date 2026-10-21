import { describe, expect, it } from 'vitest'
import { bisaAturKlub, bisaKelola, labelPeran, pesanGalatAuth, sisaHari } from '../auth'

describe('pesanGalatAuth', () => {
  it('menerjemahkan galat login yang umum ke bahasa Indonesia', () => {
    expect(pesanGalatAuth('Invalid login credentials')).toBe('Email atau sandi salah.')
    expect(pesanGalatAuth('Email not confirmed')).toContain('belum dikonfirmasi')
    expect(pesanGalatAuth('User already registered')).toContain('sudah punya akun')
    expect(pesanGalatAuth('password should be at least 6 characters')).toContain('terlalu pendek')
    expect(pesanGalatAuth('email rate limit exceeded')).toContain('Kuota kirim email Supabase')
    expect(pesanGalatAuth('too many requests')).toContain('Terlalu banyak percobaan')
    expect(pesanGalatAuth('Auth session missing!')).toContain('Sesi sudah berakhir')
    expect(pesanGalatAuth('Failed to fetch')).toContain('koneksi internet')
  })

  it('mempertahankan pesan yang tidak dikenal, dan tidak kosong', () => {
    expect(pesanGalatAuth('Galat aneh dari server')).toBe('Galat aneh dari server')
    expect(pesanGalatAuth('')).toBe('Terjadi kesalahan. Coba lagi.')
  })
})

describe('sisaHari', () => {
  it('menghitung sisa hari dengan pembulatan ke atas', () => {
    const duaHari = new Date(Date.now() + 2 * 86_400_000).toISOString()
    expect(sisaHari(duaHari)).toBe(2)
    const setengahHari = new Date(Date.now() + 12 * 3_600_000).toISOString()
    expect(sisaHari(setengahHari)).toBe(1)
  })

  it('tidak pernah negatif untuk waktu yang sudah lewat', () => {
    const lewat = new Date(Date.now() - 5 * 86_400_000).toISOString()
    expect(sisaHari(lewat)).toBe(0)
    expect(sisaHari('bukan tanggal')).toBe(0)
  })
})

describe('label peran & izin', () => {
  it('memberi label yang ramah untuk setiap peran', () => {
    expect(labelPeran('owner')).toBe('Pemilik klub')
    expect(labelPeran('admin')).toBe('Admin klub')
    expect(labelPeran('official')).toBe('Petugas pertandingan')
    expect(labelPeran('member')).toBe('Anggota')
    expect(labelPeran('org_owner')).toBe('Pemilik organisasi')
    expect(labelPeran('org_admin')).toBe('Admin organisasi')
    expect(labelPeran('entah')).toBe('entah')
  })

  it('membedakan yang boleh mengelola anggota dan yang boleh mengatur klub', () => {
    expect(bisaKelola('owner')).toBe(true)
    expect(bisaKelola('admin')).toBe(true)
    expect(bisaKelola('org_admin')).toBe(true)
    expect(bisaKelola('official')).toBe(false)
    expect(bisaKelola('member')).toBe(false)

    expect(bisaAturKlub('owner')).toBe(true)
    expect(bisaAturKlub('org_owner')).toBe(true)
    expect(bisaAturKlub('admin')).toBe(false)
    expect(bisaAturKlub('member')).toBe(false)
  })
})
