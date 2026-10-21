# Pingpong Club Manager (MVP)

**Live:** https://pingpong1234.vercel.app · **Repo:** https://github.com/Azzam-AI2/pingpong1234
_(setiap push ke `main` otomatis deploy ulang ke Vercel)_

Aplikasi web untuk mengelola klub tenis meja: anggota, turnamen **Knockout** (sistem gugur) dan
**Americano** (rotasi pasangan dengan poin individu), plus leaderboard lintas turnamen.

Dibangun dengan **React + TypeScript + Tailwind CSS (Vite)**, mobile-first, tanpa login.
Penyimpanan bisa **lokal di browser** (default) atau **online lewat Supabase Free**.

---

## 1. Fitur

**Struktur navigasi: klub adalah hierarki tertinggi.** Halaman awal adalah **daftar klub**; setelah
masuk ke sebuah klub, semua menu bekerja di dalam klub itu.

| Layar | Isi |
| --- | --- |
| **Daftar klub** (`#/`) | Buat/edit/hapus klub, lihat ringkasan tiap klub (anggota, turnamen, juara terbaru), tombol **Masuk klub** |
| **Beranda klub** (`#/klub/<id>`) | Header klub (logo, nama, tanggal dibuat) + tombol **Edit/Hapus klub**, lalu **dashboard klub**: ringkasan angka, daftar turnamen berjalan dengan progres skor, juara terbaru, dan top pemain. Navigasi lewat menu Beranda/Anggota/Turnamen/Peringkat. Panduan 3 langkah hanya muncul selama klub masih kosong |
| **Anggota** (`#/klub/<id>/anggota`) | Daftar anggota satu kartu: pencarian nama, saring gender/status, urut nama/tanggal, baris berisi avatar + identitas + status **Aktif/Nonaktif**, aksi **Edit / Duplikat / Hapus** per baris, dan peringatan saat menghapus anggota yang sudah dipakai turnamen |
| **Turnamen** (`#/klub/<id>/turnamen`) | Daftar + filter status, pembuatan **Knockout / Americano / Liga**, halaman detail turnamen |
| **Leaderboard** (`#/klub/<id>/leaderboard`) | Statistik pemain klub: jumlah pertandingan, menang/kalah, win rate, gelar, riwayat — **terpisah** Knockout dan Americano |
| **Penyimpanan** (`#/penyimpanan`) | Status mode data (lokal/online) + panduan integrasi Supabase |

Panduan ramah pengguna: kartu **"Mulai dari sini"** dengan progres 3 langkah (buat klub → tambah
anggota → buat turnamen), penjelasan bahasa awam untuk tiap jenis turnamen, petunjuk yang bisa
ditutup, dan kotak **"Langkah berikutnya"** di halaman turnamen (mis. "Skor terisi 3 dari 7
pertandingan — ketuk kartu pertandingan untuk mengisi").

**Knockout**: peserta Single (individu) atau Double (pasangan, ditentukan sebelum mulai), Best of 3/5,
undi bracket acak, bye otomatis untuk jumlah peserta non-pangkat dua, skor per game dengan validasi,
pemenang maju otomatis, status Draft → Berlangsung → Selesai, juara tampil dengan animasi (konfeti +
kartu juara). **Bagan** disusun satu kolom per babak (BABAK 32/16 BESAR → PEREMPAT FINAL → SEMIFINAL →
FINAL) dengan kartu berisi dua baris nama: pemenang tebal + jumlah game menang, yang kalah abu-abu
dicoret, BYE ditulis miring, slot yang belum terisi "—", bilah **Input skor** di kartu yang siap diisi,
dan rincian skor tiap game di bawah kartu (mis. 11–9, 5–11, 11–7). Tiap kartu diposisikan di tengah
antara dua kartu penyisihnya, dan bagan bisa digeser mendatar di layar HP.

**Americano**: 4 pemain per meja (2 vs 2), sisa pemain istirahat bergiliran, jadwal rotasi pasangan dibuat
otomatis sambil menekan pengulangan pasangan/lawan, target poin 11/15/21/24, durasi pertandingan opsional
(memunculkan timer per ronde), skor per meja, klasemen individu (poin = jumlah poin yang dicetak tim),
peringkat + jumlah pertandingan + total poin, juara individu dengan animasi.

**Anggota**: nama, jenis kelamin, foto opsional, dan status **aktif/nonaktif** (nonaktif = tidak ikut
dihitung sebagai anggota aktif, tapi riwayatnya tetap tersimpan). Bisa dicari, disaring, diurutkan,
diduplikat, dan dihapus dengan peringatan kalau sudah dipakai turnamen.

**Liga**: format Single (pemain) atau Double (pasangan tetap), rentang tanggal mulai–selesai, jadwal
round-robin otomatis (semua peserta saling bertemu sekali, peserta ganjil istirahat bergiliran, bisa
dibatasi jumlah rondenya), skor per pertandingan, klasemen peringkat dari **total poin** lalu rata-rata
poin lalu jumlah kemenangan, ringkasan statistik individu untuk Double (tanpa menghitung poin ganda),
juara + animasi. Detail aturan & keputusan teknis di [`docs/mode-liga.md`](docs/mode-liga.md).

**Aturan poin per game (Liga & Knockout)**: setiap game/pertandingan dimainkan **sampai 11 poin** —
pemenang harus mencapai 11 dan skor tidak boleh lebih dari 11 (tanpa deuce; 11-10, 11-9, 11-0, 5-11
sah; 12-10 atau 13-11 ditolak). Liga tidak lagi punya pilihan target 15/21/24. Americano tetap memakai
target 11/15/21/24 karena poinnya dijumlahkan, bukan per game.

Aturan penting: **poin Americano tidak pernah dihitung sebagai kemenangan Knockout**, dan poin Liga berdiri
sendiri di dalam liga (tidak masuk klasemen klub).

---

## 2. Menjalankan di laptop

Butuh Node.js 18+ (di mesin ini Node 26 sudah tersedia).

```bash
cd pingpong-club-manager
npm install
npm run dev          # buka alamat yang tertulis, mis. http://localhost:5173
```

Perintah lain:

```bash
npm run typecheck    # cek TypeScript
npm test             # unit test logika (bracket, rotasi Americano, statistik)
npm run build        # build produksi ke folder dist/
npm run preview      # coba hasil build
```

Tanpa file `.env`, aplikasi otomatis berjalan di **mode lokal**: data disimpan di `localStorage`
browser dan tetap ada setelah halaman dimuat ulang, tetapi hanya di perangkat itu.
Header akan menampilkan badge **● Lokal** dan banner kuning. Hapus data uji dengan tombol hapus di
aplikasi, atau jalankan `localStorage.clear()` di konsol browser.

---

## 3. Menyambungkan Supabase (online, gratis)

1. Buat project di [supabase.com](https://supabase.com) (New project, region terdekat).
2. Buka **SQL Editor → New query**, tempel seluruh isi `supabase/schema.sql`, lalu **Run**.
   Skrip itu membuat tabel, constraint validasi, index, dan policy akses.
3. **Project Settings → API**: salin **Project URL** dan **anon public** key.
4. Salin `.env.example` menjadi `.env`, isi kedua nilai itu:

   ```env
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

5. Hentikan lalu jalankan ulang `npm run dev`. Badge berubah menjadi **● Online** dan banner kuning hilang.

Halaman **Status penyimpanan** (klik badge di header) memuat langkah yang sama, tombol salin SQL,
tombol "Muat ulang data", dan sakelar "Pakai mode lokal di perangkat ini".

Catatan: data lama di browser **tidak** otomatis dipindah ke Supabase — mode online mulai dari kosong.

---

## 4. Simpan ke GitHub lalu deploy ke Vercel

```bash
# di folder project
git init
git add .
git commit -m "MVP Pingpong Club Manager (React + TS + Tailwind, Supabase opsional)"
git branch -M main
git remote add origin https://github.com/<username>/<nama-repo>.git
git push -u origin main
```

`.env` sudah masuk `.gitignore`, jadi kunci tidak ikut terkirim. Di **Vercel**:

1. New Project → import repo GitHub tadi.
2. Framework preset: **Vite** (build command `npm run build`, output `dist`).
3. **Environment Variables**: tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (kalau ingin online).
4. Deploy. Routing memakai hash (`#/klub`, `#/turnamen/<id>`), jadi tidak perlu rewrite rule.

---

## 5. Struktur project

```
src/
  lib/
    types.ts        tipe data (nama field = nama kolom Supabase)
    knockout.ts     murni: undi bracket, bye, validasi skor, hitung ulang pemenang
    americano.ts    murni: jadwal rotasi pasangan, klasemen individu
    liga.ts         murni: jadwal round-robin, validasi skor 11 poin, klasemen liga
    stats.ts        murni: statistik pemain, juara, ringkasan beranda
    storage/        backend penyimpanan: local.ts (localStorage), supabase.ts, mirror.ts
    router.ts       router hash berjenjang (klub sebagai hierarki tertinggi)
    gambar.ts       kompres foto/logo jadi data URL kecil
  state/AppContext.tsx   state global, aksi CRUD, transaksi ke backend, toast
  components/       Layout, Panduan (panduan/petunjuk), KlubForm (modal klub bersama),
                    KnockoutView, AmericanoView, LigaView, komponen UI
  pages/            PilihKlub, Dashboard (beranda klub), Anggota, Turnamen, TurnamenDetail,
                    Leaderboard, Supabase
supabase/schema.sql     skema + RLS untuk Supabase
docs/mode-liga.md       spesifikasi & rencana fitur Liga
```

Aturan main: semua jadwal, skor, klasemen, dan statistik **dihitung dari data tersimpan**, bukan angka statis.
Setiap perubahan ditulis ke backend lalu dicerminkan ke state; kalau penulisan gagal, aplikasi memuat ulang
data dari backend dan menampilkan pesan galat (tidak ada klaim sukses palsu).

---

## 6. Pengujian

```bash
npm test
```

22 unit test mencakup: ukuran bracket & bye, propagate pemenang antar babak, reset hasil lanjutan saat
skor lama diubah, validasi Best of 3/5 (seri, skor negatif, game berlebih), jadwal rotasi Americano
(8 pemain / 7 ronde = 28 pasangan unik, pembagian istirahat adil), klasemen individu, dan statistik klub.

Total saat ini **47 test di 7 berkas**, termasuk: jadwal liga round-robin (4 & 5 peserta: setiap pasangan
bertemu sekali, istirahat adil saat ganjil, batas ronde tanpa mengulang lawan), validasi skor liga
(sampai 11 poin per pertandingan, seri, nilai di luar batas), aturan 11 poin per game Knockout,
klasemen liga tanpa hitung ganda saat skor diedit/dibatalkan, regresi pemangkasan data (match liga tidak
boleh ikut terbuang saat ronde dihapus), penyaringan/penyortiran anggota (nama, gender, status, urutan), dan
format tanggal 12 bulan (pernah ada bug 'Jul' hilang yang menggeser nama bulan). Alur liga juga sudah diuji di browser: skor 12-10 ditolak
("Skor sisi pertama maksimal 11 poin per pertandingan."), skor 11-10 diterima, dan modal skor Knockout
menolak 12-10 ("Skor maksimal 11 poin per game") lalu menerima 11-9 + 11-5 → juara ditetapkan.

Alur utama lain juga sudah diuji langsung di browser (mode lokal): buat klub & 6 anggota → turnamen Knockout
6 peserta (2 bye) → 5 pertandingan diisi skor → juara otomatis + status Selesai → turnamen Americano
6 pemain 6 ronde → 6 skor diisi → juara individu (Fajar 84 poin) → turnamen **Liga** 4 pemain 3 ronde
(6 pertandingan, setiap pasangan bertemu sekali) → semua skor diisi → klasemen dihitung ulang dari data
(Budi & Cici 27 poin juara bersama, Ana & Dedi 21) → status otomatis Selesai + konfeti → leaderboard
Knockout/Americano/Gabungan → muat ulang halaman: semua skor, status, klasemen, dan juara tetap ada.
Jalur Supabase salah konfigurasi juga diuji: URL tidak dapat dihubungi menampilkan banner galat merah,
dan kunci `service_role` ditolak aplikasi.

---

## 7. Keamanan & batasan (baca sebelum dipakai bersama)

- **Tidak ada login** (sesuai lingkup MVP). Siapa pun yang mengetahui alamat aplikasi bisa membaca dan
  mengubah data. Jangan menyimpan data sensitif di aplikasi ini.
- Hanya **anon public key** yang boleh dipakai di frontend. Aplikasi akan **menolak jalan** dan memberi
  peringatan kalau mendeteksi kunci `service_role` di `.env`.
- Di Supabase, RLS aktif dengan policy khusus role `anon` untuk tabel aplikasi, ditambah constraint kolom
  (mis. `gender in ('L','P')`, `best_of in (3,5)`, skor 0–99) sebagai lapis kedua setelah validasi di UI.
  Pembatasan akses hanya bisa ketat kalau nanti ditambahkan login/RLS per pengguna.
- Foto/logo disimpan sebagai data URL (dikecilkan otomatis ke ~176 px) di kolom teks — praktis untuk MVP,
  bukan untuk banyak gambar besar.
- Dua orang mengedit data yang sama pada saat bersamaan bisa saling menimpa (tidak ada realtime/merge).
  Muat ulang halaman untuk melihat perubahan terbaru.
- Timer pertandingan adalah alat bantu tampilan; hitungannya tidak disimpan ke database.
- Belum ada: pembayaran, chat, notifikasi, analitik, login (sengaja di luar lingkup MVP).

## 8. Rencana berikutnya

- **Supabase (online)** — tinggal menyambungkan: jalankan `supabase/schema.sql` (sudah termasuk tabel
  Liga), isi `.env` lokal dan env var Vercel, lalu verifikasi badge **● Online**. Sampai itu dilakukan,
  aplikasi berjalan di mode lokal (data per browser, belum dibagi antar anggota).
- **Kandidat lanjutan** (belum diminta): memasukkan hasil Liga ke leaderboard klub sebagai tab
  tersendiri, mode liga "bertemu dua kali", dan statistik lawan/game per pemain.
