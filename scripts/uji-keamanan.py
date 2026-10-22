"""
Uji keamanan langsung ke API Supabase (tanpa UI).
Memakai anon key sebagai "penyusup" untuk membuktikan RLS + trigger skor bekerja.

Jalankan:  python scripts/uji-keamanan.py
Hasil: ringkasan PASS/FAIL, dan semua data uji dihapus di akhir.
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
isi_env = open(os.path.join(AKAR, ".env"), encoding="utf-8").read()
URL = re.search(r"VITE_SUPABASE_URL=(.+)", isi_env).group(1).strip()
KEY = re.search(r"VITE_SUPABASE_ANON_KEY=(.+)", isi_env).group(1).strip()

H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
hasil = []


def req(method, path, body=None, prefer=None):
    h = dict(H)
    if prefer:
        h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=25) as resp:
            teks = resp.read().decode()
            return resp.status, (json.loads(teks) if teks else None)
    except urllib.error.HTTPError as e:
        teks = e.read().decode()
        try:
            return e.code, json.loads(teks)
        except Exception:
            return e.code, {"raw": teks[:200]}


def cek(nama, kondisi, detail=""):
    hasil.append((nama, kondisi, detail))
    print(("  PASS  " if kondisi else "  FAIL  ") + nama + (f"  [{detail}]" if detail else ""))


print("=== Persiapan ===")
st, klub = req("GET", "/rest/v1/clubs?select=id,name,sport_slug&limit=1")
if not klub:
    print("tidak ada klub, berhenti")
    sys.exit(0)
klub_id = klub[0]["id"]
print(f"klub uji: {klub[0]['name']} ({klub[0].get('sport_slug')})")

dibersihkan = []


def buat_turnamen(club, tipe="knockout", best_of=3, settings=None):
    st, d = req(
        "POST",
        "/rest/v1/tournaments",
        {
            "club_id": club,
            "name": "zz-uji-keamanan",
            "date": "2026-10-21",
            "type": tipe,
            "format": "single" if tipe == "knockout" else None,
            "best_of": best_of if tipe == "knockout" else None,
            "status": "draft",
            "settings": settings or {},
        },
        prefer="return=representation",
    )
    if st in (200, 201) and d:
        dibersihkan.append(("tournaments", d[0]["id"]))
        return d[0]["id"]
    print("    (gagal buat turnamen)", st, d)
    return None


def buat_peserta(turnamen, label):
    st, d = req(
        "POST",
        "/rest/v1/participants",
        {"tournament_id": turnamen, "label": label, "member_ids": []},
        prefer="return=representation",
    )
    if st in (200, 201) and d:
        dibersihkan.append(("participants", d[0]["id"]))
        return d[0]["id"]
    return None


_posisi = 0


def buat_match(turnamen, a, b, games, winner=None):
    global _posisi
    _posisi += 1
    return req(
        "POST",
        "/rest/v1/knockout_matches",
        {
            "tournament_id": turnamen,
            "round": 1,
            "position": _posisi,
            "participant_a": a,
            "participant_b": b,
            "games": games,
            "winner_id": winner,
        },
        prefer="return=representation",
    )


print("\n=== 1. Skor tidak sah harus DITOLAK database (pingpong 11 poin) ===")
t1 = buat_turnamen(klub_id)
if t1:
    p1, p2 = buat_peserta(t1, "Tim A"), buat_peserta(t1, "Tim B")
    st, d = buat_match(t1, p1, p2, [{"a": 12, "b": 10}])
    cek("skor 12-10 ditolak", st >= 400, (d or {}).get("message", "")[:90])

    print("\n=== 2. Pemenang dihitung database, bukan dari klien ===")
    st, d = buat_match(t1, p1, p2, [{"a": 11, "b": 9}, {"a": 11, "b": 7}], winner=p2)
    if st in (200, 201) and d:
        mid = d[0]["id"]
        dibersihkan.append(("knockout_matches", mid))
        tersimpan = d[0]["winner_id"]
        cek("winner_id palsu (p2) dikoreksi jadi p1", tersimpan == p1, f"tersimpan={tersimpan}")
    else:
        cek("skor sah diterima", False, str(st))

    print("\n=== 3. Skor belum selesai tidak boleh menyimpan pemenang ===")
    st, d = buat_match(t1, p1, p2, [{"a": 11, "b": 9}], winner=p1)
    if st in (200, 201) and d:
        mid = d[0]["id"]
        dibersihkan.append(("knockout_matches", mid))
        cek("winner_id null saat best of 3 baru 1 game", d[0]["winner_id"] is None, f"= {d[0]['winner_id']}")
    else:
        cek("skor belum selesai diterima tanpa pemenang", False, f"HTTP {st} {(d or {}).get('message','')[:80]}")

print("\n=== 4. Cabang berbeda, aturan berbeda (badminton 21, unggul 2) ===")
st, d = req(
    "POST",
    "/rest/v1/clubs",
    {"name": "zz-uji-badminton", "logo_url": None, "sport_slug": "badminton"},
    prefer="return=representation",
)
if st in (200, 201) and d:
    klub_b = d[0]["id"]
    dibersihkan.append(("clubs", klub_b))
    tb = buat_turnamen(klub_b)
    if tb:
        pb1 = buat_peserta(tb, "Pemain 1")
        pb2 = buat_peserta(tb, "Pemain 2")
        st, dd = buat_match(tb, pb1, pb2, [{"a": 21, "b": 19}, {"a": 21, "b": 18}])
        cek("badminton 21-19 & 21-18 diterima", st in (200, 201), f"HTTP {st}")
        if st in (200, 201) and dd:
            dibersihkan.append(("knockout_matches", dd[0]["id"]))
        st, dd = buat_match(tb, pb1, pb2, [{"a": 21, "b": 20}])
        cek("badminton 21-20 ditolak", st >= 400, (dd or {}).get("message", "")[:90])
else:
    print("    (buat klub badminton gagal — mungkin policy klub_buat sudah ketat)", st)

print("\n=== 5. Akses tanpa login (anon) — status sebelum 023 ===")
st, d = req("GET", "/rest/v1/clubs?select=id")
cek("anon masih bisa membaca klub (ditunggu sebelum 023)", st == 200 and len(d or []) >= 1, f"{len(d or [])} baris")

print("\n=== Pembersihan ===")
for tabel, id_ in reversed(dibersihkan):
    st, _ = req("DELETE", f"/rest/v1/{tabel}?id=eq.{id_}")
    print(f"  hapus {tabel} {id_[:8]}… → HTTP {st}")

gagal = [h for h in hasil if not h[1]]
print(f"\nRingkasan: {len(hasil) - len(gagal)}/{len(hasil)} uji sesuai harapan")
sys.exit(1 if gagal else 0)
