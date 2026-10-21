# Fitur Tambahan: Mode Liga

> Status: **sudah diimplementasikan** (mode turnamen ketiga di aplikasi, berdampingan dengan Knockout
> dan Americano). Isi bagian 1–6 adalah spesifikasi dari pemilik produk; bagian 7 mencatat keputusan
> teknis yang diambil saat implementasi.

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

## 7. Catatan implementasi

**Logika murni — `src/lib/liga.ts`** (diuji tanpa browser, 9 unit test):

- `buatJadwalLiga(pesertaIds, maksRonde?)` — jadwal semua-peserta-bertemu dengan metode lingkaran
  (circle method): setiap pasangan bertemu tepat sekali; jumlah peserta ganjil ditangani dengan bye
  bergiliran; opsi batas jumlah ronde memotong jadwal tanpa mengulang lawan.
- `hitungKlasemenLiga(peserta, matches, namaAnggota)` — total poin dari skor tim, rata-rata poin per
  pertandingan, menang/kalah; urut total poin → rata-rata → kemenangan. Klasemen **selalu dihitung
  ulang** dari data match tersimpan sehingga mengedit atau membatalkan skor tidak pernah menggandakan
  poin. Peringkat utama di level peserta (pasangan untuk Double); ringkasan pemain bersifat tambahan
  dan tidak menambah poin klasemen.
- `validasiSkorLiga(skorA, skorB, targetPoin = 11)` — setiap pertandingan dimainkan **sampai 11 poin**:
  pemenang harus mencapai 11, skor tidak boleh melebihi 11, bilangan bulat, tidak boleh seri.

**Database (Supabase)** — tabel terpisah, tidak menyentuh tabel Knockout/Americano:

- `league_rounds` (id, tournament_id, round_no)
- `league_matches` (id, tournament_id, round_id, round_no, court_no, team_a jsonb, team_b jsonb,
  score_a, score_b) — `team_a`/`team_b` berisi id anggota (1 untuk Single, 2 untuk Double)
- `tournaments` ditambah kolom `date_end` dan `rounds_planned`, dan `type` menerima nilai `'liga'`.
  `supabase/schema.sql` memuat blok migrasi (`alter table ... add column if not exists`) yang aman
  dijalankan ulang pada database yang sudah ada.
- Peserta liga memakai tabel `participants` yang sudah ada (label + member_ids).

**Keputusan yang diambil** (bisa diubah kalau pemilik produk mau beda):

1. **Batas 11 poin per pertandingan** (arahan pemilik produk): pemenang harus mencapai 11 poin dan
   skor tidak boleh lebih dari 11 — tanpa deuce. Jadi 11-10, 11-9, 11-0, dan 5-11 sah, sedangkan 12-10
   atau 13-11 ditolak. Pilihan target 15/21/24 dihapus dari Liga (Knockout mengikuti aturan yang sama,
   Americano tetap 11/15/21/24 karena poinnya dijumlahkan).
2. **Peserta ganjil**: satu peserta istirahat tiap ronde, diputar merata oleh metode lingkaran.
3. **Satu putaran** (semua peserta bertemu sekali) dengan opsi batas jumlah ronde; belum ada mode
   "bertemu dua kali".
