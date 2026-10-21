// ============================================================================
// Edge Function: invite-member
// ============================================================================
// Tugas: mengundang anggota ke klub lewat Supabase Admin API, dan membatalkan
// undangan. Service role key HANYA hidup di sisi server (secret fungsi ini),
// tidak pernah dikirim ke browser.
//
// Aksi:
//   { aksi: "undang",   club_id, email, role }
//   { aksi: "batalkan", club_id, email }
//   { aksi: "daftar",   club_id }
//
// Pemeriksaan izin memakai JWT pemanggil + fungsi has_perm() di database,
// jadi UI yang menyembunyikan tombol tidak menentukan apa pun.

import { createClient } from 'npm:@supabase/supabase-js@2'

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const KUNCI_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const KUNCI_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jawab(isi: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const PERAN_SAH = ['admin', 'official', 'member'] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return jawab({ ok: false, pesan: 'Gunakan POST.' }, 405)

  const izin = req.headers.get('Authorization')
  if (!izin) return jawab({ ok: false, pesan: 'Butuh login.' }, 401)

  // Klien "sebagai pengguna": semua pemeriksaan izin memakai identitas pemanggil.
  const sebagaiPengguna = createClient(URL_SUPABASE, KUNCI_ANON, {
    global: { headers: { Authorization: izin } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: pengguna, error: galatPengguna } = await sebagaiPengguna.auth.getUser()
  if (galatPengguna || !pengguna.user) return jawab({ ok: false, pesan: 'Sesi tidak valid.' }, 401)

  let muatan: Record<string, unknown>
  try {
    muatan = (await req.json()) as Record<string, unknown>
  } catch {
    return jawab({ ok: false, pesan: 'Body bukan JSON.' }, 400)
  }

  const clubId = String(muatan.club_id ?? '').trim()
  if (!clubId) return jawab({ ok: false, pesan: 'club_id wajib diisi.' }, 400)

  // Izin dasar: harus boleh mengelola anggota klub ini.
  const { data: bolehKelola, error: galatIzin } = await sebagaiPengguna.rpc('has_perm', {
    p_club: clubId,
    p_perm: 'club.manage_members',
  })
  if (galatIzin) return jawab({ ok: false, pesan: `Gagal memeriksa izin: ${galatIzin.message}` }, 500)
  if (!bolehKelola) {
    return jawab({ ok: false, pesan: 'Kamu tidak berwenang mengelola anggota klub ini.' }, 403)
  }

  const admin = createClient(URL_SUPABASE, KUNCI_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const aksi = String(muatan.aksi ?? 'undang').toLowerCase()

  // ---------------------------------------------------------------- daftar undangan
  if (aksi === 'daftar') {
    const { data, error } = await admin
      .from('club_invitations')
      .select('id, email, role, status, expires_at, created_at')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return jawab({ ok: false, pesan: error.message }, 500)
    return jawab({ ok: true, undangan: data ?? [] })
  }

  const surel = String(muatan.email ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(surel)) {
    return jawab({ ok: false, pesan: 'Format email tidak valid.' }, 400)
  }

  // ---------------------------------------------------------------- batalkan
  if (aksi === 'batalkan') {
    const { data, error } = await admin
      .from('club_invitations')
      .update({ status: 'revoked' })
      .eq('club_id', clubId)
      .eq('email', surel)
      .eq('status', 'pending')
      .select('id')
    if (error) return jawab({ ok: false, pesan: error.message }, 500)
    if (!data || data.length === 0) {
      return jawab({ ok: false, pesan: 'Tidak ada undangan pending untuk email itu.' }, 404)
    }

    await admin.from('audit_logs').insert({
      actor_user_id: pengguna.user.id,
      club_id: clubId,
      action: 'undangan_dibatalkan',
      entity_type: 'club_invitation',
      entity_id: String(data[0].id),
      metadata: { email: surel },
    })
    return jawab({ ok: true, pesan: 'Undangan dibatalkan.' })
  }

  if (aksi !== 'undang') return jawab({ ok: false, pesan: `Aksi "${aksi}" tidak dikenal.` }, 400)

  // ---------------------------------------------------------------- undang
  const peran = String(muatan.role ?? 'member').toLowerCase()
  const { data: bolehAturPeran } = await sebagaiPengguna.rpc('has_perm', {
    p_club: clubId,
    p_perm: 'club.manage_roles',
  })
  const peranDiizinkan: string[] = bolehAturPeran ? [...PERAN_SAH] : ['official', 'member']
  if (!peranDiizinkan.includes(peran)) {
    return jawab(
      {
        ok: false,
        pesan: `Peran "${peran}" tidak boleh kamu berikan. Pilihan: ${peranDiizinkan.join(', ')}.`,
      },
      403,
    )
  }

  // Sudah jadi anggota aktif?
  const { data: keanggotaan } = await admin
    .from('club_members')
    .select('id, status, user_id')
    .eq('club_id', clubId)
    .limit(1000)

  const { data: daftarPengguna } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const akun = daftarPengguna?.users?.find((u) => (u.email ?? '').toLowerCase() === surel)
  if (akun && (keanggotaan ?? []).some((k) => k.user_id === akun.id && k.status === 'active')) {
    return jawab({ ok: false, pesan: 'Email ini sudah menjadi anggota aktif klub.' }, 409)
  }

  // Simpan/perbarui undangan (satu undangan pending per klub+email).
  // Catatan: indeks uniknya partial + lower(email), jadi upsert ON CONFLICT
  // bawaan tidak bisa dipakai; cek manual lalu update atau insert.
  const kedaluwarsa = new Date(Date.now() + 7 * 86_400_000).toISOString()

  const { data: undanganLama } = await admin
    .from('club_invitations')
    .select('id')
    .eq('club_id', clubId)
    .eq('email', surel)
    .eq('status', 'pending')
    .maybeSingle()

  let idUndangan = undanganLama?.id as string | undefined

  if (idUndangan) {
    const { error } = await admin
      .from('club_invitations')
      .update({ role: peran, invited_by: pengguna.user.id, expires_at: kedaluwarsa })
      .eq('id', idUndangan)
    if (error) {
      return jawab({ ok: false, pesan: `Gagal memperbarui undangan: ${error.message}` }, 500)
    }
  } else {
    const { data: baru, error } = await admin
      .from('club_invitations')
      .insert({
        club_id: clubId,
        email: surel,
        role: peran,
        invited_by: pengguna.user.id,
        status: 'pending',
        expires_at: kedaluwarsa,
      })
      .select('id')
      .single()
    if (error) {
      return jawab({ ok: false, pesan: `Gagal menyimpan undangan: ${error.message}` }, 500)
    }
    idUndangan = baru?.id
  }

  await admin.from('audit_logs').insert({
    actor_user_id: pengguna.user.id,
    club_id: clubId,
    action: 'undangan_dibuat',
    entity_type: 'club_invitation',
    entity_id: idUndangan ?? null,
    metadata: { email: surel, role: peran },
  })

  // Kirim email undangan hanya untuk akun baru; akun lama menerima di aplikasi.
  if (akun) {
    return jawab({
      ok: true,
      status: 'sudah_punya_akun',
      pesan:
        'Email ini sudah punya akun. Undangan tersimpan dan akan muncul di halaman "Undangan" setelah dia masuk.',
    })
  }

  const { error: galatKirim } = await admin.auth.admin.inviteUserByEmail(surel, {
    redirectTo: APP_URL ? `${APP_URL}/` : undefined,
  })
  if (galatKirim) {
    return jawab(
      {
        ok: true,
        status: 'undangan_tersimpan_email_gagal',
        pesan: `Undangan tersimpan, tetapi email gagal dikirim: ${galatKirim.message}`,
      },
      200,
    )
  }

  return jawab({ ok: true, status: 'email_terkirim', pesan: `Undangan dikirim ke ${surel}.` })
})
