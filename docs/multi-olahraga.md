# Multi-Olahraga: Pingpong, Badminton, Padel

Dokumen kerja untuk perluasan aplikasi menjadi platform klub multi-olahraga.
Prinsip: **tidak ada rewrite**, perilaku pingpong tidak berubah, aturan olahraga
dipisah dari UI dan database.

## 1. Audit singkat kondisi awal

| Bagian | Kondisi sebelum perubahan | Keputusan |
|---|---|---|
| Logika skor | Tertanam di `kotak`: `knockout.ts` (`POIN_MAKS_GAME = 11`), `liga.ts` (`POIN_MAKS_LIGA = 11`) | Aturan dipindah ke data (`src/lib/sports.ts`), fungsi skor jadi murni & teruji |
| Cabang olahraga | Tidak ada di data; semua klub diasumsikan pingpong | `clubs.sport_slug` + registry `DAFTAR_OLAHRAGA` |
| Format kompetisi | Semua format ditampilkan untuk semua klub | Difilter per cabang (`formatTersedia`) |
| Peserta | Single/double sudah didukung (`participants.member_ids`) | Dipakai ulang untuk bulu tangkis & padel |
| Tournament | Sudah menyimpan `type`, `format`, `best_of`, `target_points`, `date_end`, `rounds_planned` | Cukup dipakai ulang; aturan detail menyusul di `club_sport_settings.settings` |
| Skor pertandingan | `knockout_matches.games[]` dan `league_matches.score_a/b` | `games[]` dipakai juga untuk set padel (satu elemen = satu set) |

## 2. Yang sudah diimplementasikan (tahap 1–2)

- `src/lib/sports.ts` — registry cabang olahraga + mesin skor murni:
  - `ATURAN_TENIS_MEJA` (11 poin, tanpa deuce),
  - `ATURAN_BULU_TANGKIS` (21 poin rally, unggul 2, batas 30),
  - `ATURAN_PADEL_SET` (set 6 game, selisih 2, tiebreak 7-6, opsi golden point),
  - `ATURAN_PADEL_AMERICANO` (poin, tanpa pemenang game).
  - fungsi: `pemenangGame`, `validasiGame`, `validasiPertandingan`, `pemenangPertandingan`,
    `ringkasPertandingan`, `statusPoinTenis` (deuce/advantage/golden point), `formatTersedia`,
    `formatDidukung`, `profilOlahraga`.
- `sql/018_sport_klub.sql` — kolom `clubs.sport_slug` (default `table_tennis`, FK ke `sports.slug`),
  sinkronisasi `club_sport_settings` untuk klub lama. Rollback tercatat di akhir file.
- Klub baru: pilihan **Jenis olahraga** (Pingpong / Bulu Tangkis / Padel) di modal klub;
  hanya bisa dipilih saat membuat, tidak diubah lewat edit.
- Turnamen: daftar format **difilter per cabang** — Padel hanya Knockout + Americano;
  Bulu Tangkis & Pingpong Knockout + Liga (+ Americano untuk pingpong yang sudah ada).
- Test: `src/lib/__tests__/sports.test.ts` (16 test) — **78/78 test lulus**, tidak ada regresi pingpong.

## 3. Tahap berikutnya (belum dikerjakan)

| Tahap | Isi | Status |
|---|---|---|
| 3 | Input skor **bulu tangkis** (21/deuce/30) di modal pertandingan & klasemen liga | ✅ selesai (commit `84a1649`) |
| 4 | Input skor **padel tennis** per set + label "Set 1/2/3" di modal & "Jumlah set" saat buat turnamen | ✅ selesai (commit `ceb8668`) |
| 5 | **Americano padel**: rotasi 2v2 per meja, larangan pemain dobel per ronde, target poin dari konfigurasi kompetisi | ✅ mesin + validasi teruji; UI Americano memakai komponen yang sama |
| 6 | Konfigurasi per kompetisi: `tournaments.settings` (tiebreak, golden point, target) dibaca mesin skor + form turnamen padel | ✅ klien selesai (commit `84bf4dc`); ⏳ validasi pemenang di server menyusul saat RLS diketatkan |

### Catatan skema untuk tahap 6

- `tournaments.settings jsonb` — menyimpan `{ target, batasMaks, bestOf, tiebreak, goldenPoint, modeSkor }`
  agar aturan yang dipakai konsisten untuk semua pertandingan dalam satu kompetisi.
- Hasil pertandingan tetap disimpan sebagai data mentah (`games`/`score_a`), klasemen dihitung ulang
  dari hasil — supaya koreksi skor selalu konsisten.
- Semua perhitungan pemenang/klasemen akan dipindah ke RPC saat RLS diketatkan (fase 4),
  sehingga klien tidak bisa mengirim pemenang palsu.

## 4. Risiko yang dipantau

1. **Padel memakai `games[]` sebagai set** — perlu label UI yang jelas ("set 1: 6-4") agar tidak
   tertukar dengan "game" pada tenis meja.
2. **Klub lama** tanpa `sport_slug` otomatis `table_tennis`; kalau ada data tanpa kolom (mode lokal
   sebelum migrasi), `profilOlahraga()` tetap jatuh ke tenis meja.
3. **Perubahan jenis olahraga** pada klub yang sudah punya kompetisi: saat ini UI tidak menyediakan
   perubahan. Kalau nanti dibutuhkan, wajib validasi "tidak ada kompetisi" lebih dulu.
4. **Bulu tangkis best of 5** masih diizinkan lewat `best_of`; aturan resmi BWF best of 3, tapi
   dibiarkan sebagai konfigurasi penyelenggara sesuai requirement.
