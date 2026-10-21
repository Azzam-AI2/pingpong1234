# Fitur Tambahan: Mode Liga (rencana)

> Status: **belum diimplementasikan**. Dikerjakan setelah langkah Supabase (online) selesai.
> Isi bagian 0 di bawah adalah spesifikasi apa adanya dari pemilik produk; bagian 7 adalah catatan
> teknis bagaimana fitur ini menempel ke struktur aplikasi yang sudah ada.

Buat mode turnamen **Liga** dengan dua format: **Single** dan **Double**. Tujuan utamanya adalah
mengumpulkan poin sebanyak-banyaknya. Pemain atau tim dengan total poin tertinggi menjadi juara.

## 1. Pengaturan Liga

- Nama liga, klub, tanggal mulai, dan tanggal selesai.
- Format pertandingan: Single atau Double.
- Daftar peserta dipilih dari anggota klub.
- Untuk format Double, peserta bermain dalam pasangan tetap selama liga berlangsung.
- Tentukan target poin setiap pertandingan, misalnya 11, 15, 21, atau 24.
- Tentukan jumlah ronde atau gunakan opsi semua peserta bertemu sesuai format yang dipilih.
- Liga dapat disimpan sebagai Draft, Berlangsung, atau Selesai.

## 2. Sistem Pertandingan

- **Single:** satu pemain melawan satu pemain.
- **Double:** satu pasangan melawan pasangan lainnya.
- Setiap pertandingan memiliki dua sisi skor.
- Skor dicatat berdasarkan poin yang benar-benar diperoleh masing-masing pemain atau tim.
- Pemenang pertandingan adalah pihak yang mencapai target poin sesuai aturan pertandingan.
- Pertandingan dianggap selesai setelah skor valid disimpan.
- Jadwal pertandingan dibuat otomatis dan mengusahakan pembagian lawan yang merata.

## 3. Sistem Poin Liga

- Poin klasemen dihitung dari total poin yang dicetak sepanjang liga, **bukan** dari jumlah kemenangan.
- Pada format Single, poin pertandingan ditambahkan ke total poin pemain yang bersangkutan.
- Pada format Double, poin yang dicetak pasangan ditambahkan dengan nilai yang sama ke total poin
  kedua pemain.
- Contoh: pasangan A menang 21–15. Kedua anggota pasangan A mendapat tambahan 21 poin, sedangkan
  kedua anggota pasangan lawan mendapat tambahan 15 poin.
- Hasil pertandingan yang telah disimpan harus langsung memperbarui klasemen.
- Jika skor diedit atau pertandingan dibatalkan, poin klasemen harus dihitung ulang agar tidak
  terjadi penghitungan ganda.

## 4. Klasemen

Tampilkan tabel klasemen yang memuat:

- Peringkat.
- Nama pemain atau pasangan.
- Jumlah pertandingan.
- Total poin yang dicetak.
- Jumlah kemenangan dan kekalahan sebagai statistik tambahan.
- Rata-rata poin per pertandingan.

Urutkan klasemen berdasarkan **total poin tertinggi**. Jika total poin sama, gunakan rata-rata poin
per pertandingan sebagai pemecah seri, kemudian jumlah kemenangan.

Pada format Double, tampilkan nama pasangan sekaligus statistik individual setiap anggota. Pastikan
total poin pasangan dan total poin individual tidak tercampur atau dihitung dua kali pada level liga.

## 5. Dashboard dan Hasil Liga

- Tampilkan pemimpin klasemen sementara.
- Tampilkan jadwal pertandingan yang belum dimainkan dan hasil pertandingan yang telah selesai.
- Sediakan input skor dan riwayat hasil pertandingan.
- Saat liga berakhir, tetapkan juara berdasarkan peringkat pertama klasemen.
- Tampilkan animasi sederhana untuk merayakan juara.
- Simpan seluruh konfigurasi, jadwal, skor, dan klasemen secara persisten di database.

## 6. Validasi dan Pengujian

- Cegah peserta bermain melawan dirinya sendiri pada format Single.
- Pada format Double, cegah anggota yang sama dimasukkan dua kali dalam satu pasangan atau dua
  pasangan berbeda pada liga yang sama.
- Validasi skor berdasarkan target poin dan aturan pertandingan yang ditentukan.
- Jangan menghitung poin dari pertandingan yang belum selesai atau dibatalkan.
- Pastikan skor hasil edit tidak menambah poin dua kali.
- Pastikan klasemen tetap konsisten setelah halaman dimuat ulang.

Gunakan komponen dan struktur database yang dapat digunakan kembali dari fitur turnamen lainnya.
Implementasikan fitur Liga sebagai modul tersendiri tanpa merusak fitur Knockout dan Americano yang
sudah ada.

---

## 7. Catatan teknis (rencana implementasi)

Bagian ini bukan permintaan produk, hanya rencana teknis agar pekerjaan nanti cepat.

**Logika murni — `src/lib/liga.ts`** (dapat diuji tanpa browser):

- `buatJadwalRoundRobin(pesertaIds, maksRonde?)` — jadwal semua-peserta-bertemu dengan metode
  lingkaran (circle method); jumlah peserta ganjil ditangani dengan bye bergiliran; opsi batas
  jumlah ronde memotong jadwal secara merata (setiap peserta main mendekati jumlah ronde yang sama).
- `hitungKlasemen(liga, peserta, matches)` — total poin dari skor tim, rata-rata poin/pertandingan,
  menang/kalah; urut total poin → rata-rata → kemenangan. Klasemen **selalu dihitung ulang** dari
  data match tersimpan sehingga mengedit atau membatalkan skor tidak pernah menggandakan poin.
- `validasiSkorLiga(skorA, skorB, targetPoin)` — pemenang wajib mencapai target poin (dengan aturan
  selisih 2 saat deuce), skor 0–99, tidak boleh seri, dan pertandingan yang dibatalkan tidak dihitung.

**Database (Supabase)** — pola sama seperti Americano, tabel terpisah agar fitur lain tidak berubah:

- `leagues` (id, club_id, name, date_start, date_end, format single/double, target_points,
  rounds_planned, status draft/ongoing/finished)
- `league_rounds` (id, league_id, round_no)
- `league_matches` (id, league_id, round_id, round_no, court_no, team_a jsonb, team_b jsonb,
  score_a, score_b) — `team_a`/`team_b` berisi id anggota (1 untuk Single, 2 untuk Double)
- Peserta liga memakai tabel `participants` yang sudah ada (label + member_ids), sehingga statistik
  dan riwayat bisa memakai tabel yang sama.

**Klasemen Double tanpa hitung ganda**: peringkat utama ditampilkan pada level **pasangan**
(total poin pasangan), sedangkan statistik anggota ditampilkan sebagai ringkasan pemain di bawahnya —
poin pasangan tidak ditambahkan lagi ke total level liga saat menampilkan pemain.

**Yang perlu diputuskan saat implementasi** (tanyakan dulu ke pemilik produk):

1. Aturan kemenangan saat skor melewati target: wajib selisih 2 (deuce) atau sederhana "yang lebih
   tinggi menang"?
2. Bila jumlah peserta ganjil pada format Double — peserta mana yang istirahat, dan apakah istirahat
   bergiliran wajib adil?
3. Apakah liga boleh memakai format "semua peserta bertemu dua kali" (home-away)?
