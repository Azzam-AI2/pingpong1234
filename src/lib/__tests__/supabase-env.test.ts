import { describe, expect, it } from 'vitest'
import { bacaKonfigurasiSupabase } from '../storage/supabase'

/** JWT palsu: header.payload.signature, payload berisi role. */
function jwt(payload: Record<string, unknown>): string {
  const isi = btoa(JSON.stringify(payload)).replace(/=+$/, '')
  return `eyJhbGciOiJIUzI1NiJ9.${isi}.tanda`
}

const env = (url: string, key: string) =>
  ({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key }) as unknown as ImportMetaEnv

describe('konfigurasi Supabase hanya dari env', () => {
  it('belum diatur kalau env kosong', () => {
    const cek = bacaKonfigurasiSupabase(env('', ''))
    expect(cek.status).toBe('belum-diatur')
    expect(cek.pesan).toContain('belum diisi')
  })

  it('menolak URL yang bukan http(s) atau mengandung spasi', () => {
    expect(bacaKonfigurasiSupabase(env('bukan-url', jwt({ role: 'anon' }))).status).toBe(
      'url-tidak-valid',
    )
    expect(
      bacaKonfigurasiSupabase(env('https://a b.supabase.co', jwt({ role: 'anon' }))).status,
    ).toBe('url-tidak-valid')
  })

  it('menolak service_role key', () => {
    const cek = bacaKonfigurasiSupabase(
      env('https://abc.supabase.co', jwt({ role: 'service_role' })),
    )
    expect(cek.status).toBe('kunci-terlarang')
    expect(cek.pesan).toContain('service_role')
  })

  it('menerima anon key dan mengembalikan nilainya', () => {
    const cek = bacaKonfigurasiSupabase(env('https://abc.supabase.co', jwt({ role: 'anon' })))
    expect(cek.status).toBe('siap')
    expect(cek.url).toBe('https://abc.supabase.co')
    expect(cek.pesan).toContain('.env')
  })

  it('memangkas spasi di sekitar nilai env', () => {
    const cek = bacaKonfigurasiSupabase(env('  https://abc.supabase.co  ', '  ' + jwt({ role: 'anon' }) + '  '))
    expect(cek.status).toBe('siap')
    expect(cek.url).toBe('https://abc.supabase.co')
  })
})
