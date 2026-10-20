/** Kompres gambar (logo klub / foto anggota) jadi data URL kecil agar aman disimpan di database. */
export async function fileKeDataUrl(file: File, sisiMaks = 176, mutu = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (JPG/PNG/WebP).')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran gambar maksimal 5 MB.')
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Gambar tidak bisa dibuka.'))
    el.src = dataUrl
  })

  const skala = Math.min(1, sisiMaks / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * skala))
  const h = Math.max(1, Math.round(img.height * skala))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', mutu)
}
