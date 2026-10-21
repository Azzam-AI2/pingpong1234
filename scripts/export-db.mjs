// Ekspor seluruh tabel aplikasi ke file JSON (cadangan sebelum migrasi).
// Pemakaian:  node scripts/export-db.mjs
// Membaca VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY dari .env (hanya baca).

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const akar = dirname(dirname(fileURLToPath(import.meta.url)))

const TABEL = [
  'clubs',
  'members',
  'tournaments',
  'participants',
  'knockout_matches',
  'americano_rounds',
  'americano_matches',
  'league_rounds',
  'league_matches',
]

function bacaEnv() {
  const isi = readFileSync(join(akar, '.env'), 'utf8')
  const ambil = (kunci) => {
    const m = isi.match(new RegExp(`^${kunci}=(.*)$`, 'm'))
    return m ? m[1].trim() : ''
  }
  return { url: ambil('VITE_SUPABASE_URL'), key: ambil('VITE_SUPABASE_ANON_KEY') }
}

const { url, key } = bacaEnv()
if (!url || !key) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tidak ada di .env')
  process.exit(1)
}

const cap = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const folder = join(akar, 'backup', cap)
mkdirSync(folder, { recursive: true })

const ringkasan = []
for (const tabel of TABEL) {
  const res = await fetch(`${url}/rest/v1/${tabel}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    console.error(`${tabel}: HTTP ${res.status} — ${(await res.text()).slice(0, 120)}`)
    process.exit(1)
  }
  const data = await res.json()
  writeFileSync(join(folder, `${tabel}.json`), JSON.stringify(data, null, 2))
  ringkasan.push({ tabel, baris: data.length })
  console.log(`${tabel.padEnd(20)} ${String(data.length).padStart(4)} baris`)
}

writeFileSync(join(folder, '_ringkasan.json'), JSON.stringify({ waktu: cap, url, tabel: ringkasan }, null, 2))
console.log(`\nCadangan tersimpan di ${folder}`)
