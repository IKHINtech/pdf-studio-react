# PDF Studio React

Editor PDF client-side berbasis React + TypeScript.

## Fitur

- Merge banyak PDF
- Sisipkan PDF setelah halaman tertentu atau di akhir
- Drag & drop urutan halaman
- Hapus dan rotate halaman
- Preview satu halaman seperti Canva
- Timeline halaman selalu tampil di bawah editor
- Zoom in / zoom out halaman fokus
- Tambah teks baru di atas PDF
- Tambah gambar PNG/JPG di atas PDF
- Tambah tanda tangan PNG/JPG di atas PDF
- Geser objek edit, ubah ukuran, edit teks, dan hapus objek
- Export PDF final langsung dari browser

## Cara Run

```bash
npm install
npm run dev
```

Buka:

```text
http://localhost:5173
```

Jika npm masih memakai registry lama/internal:

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --registry=https://registry.npmjs.org/
npm run dev
```

## Catatan

Fitur edit memakai konsep overlay annotation. Artinya teks/gambar/tanda tangan baru ditanamkan ke halaman saat export. Ini bukan edit teks asli PDF seperti Word.


## Update v6

- Toolbar/properties editor dibuat horizontal-scroll agar kontrol tidak tertutup di layar kecil.
- Inspector teks/gambar/tanda tangan bisa digeser kiri-kanan.
- Tambah tombol **Copy page** untuk menduplikasi halaman aktif beserta annotation di halaman tersebut.
