# Instruksi & Aturan Kerja Agent (AGENTS.md)

Dokumen ini berisi panduan, aturan arsitektur, dan Standar Operasional Prosedur (SOP) untuk AI/Agent yang bekerja pada repositori **Metalizer**.

---

## 1. Ikhtisar Proyek
- **Metalizer**: Desktop application berbasis **Tauri v2 + React 19 + TypeScript + Tailwind CSS** dan **Rust** untuk pembuatan metadata Adobe Stock (gambar, vektor EPS/SVG, dan video).
- **Frontend**: Vite, React, Zustand, Lucide Icons, Vitest.
- **Backend (Rust)**: `src-tauri/` (Tauri v2, Stronghold, resvg, image crate, custom EPS/TIFF parser).

---

## 2. Protokol Rilis Production (RELEASE SOP)

Setiap kali pengguna meminta tindakan terkait **"release"**, **"build release"**, **"build production"**, atau persiapan rilis baru:

### A. Wajib Sinkronisasi Versi (3 File)
Nomor versi **harus sama persis** di ketiga file berikut sebelum membuat commit rilis:
1. `package.json` (`"version": "x.y.z"`)
2. `src-tauri/Cargo.toml` (`version = "x.y.z"`)
3. `src-tauri/tauri.conf.json` (`"version": "x.y.z"`)

*Catatan: Selalu periksa `git tag -l` terlebih dahulu untuk mengetahui tag rilis terakhir sebelum menaikkan versi.*

### B. Validasi & Pengujian Wajib (Harus Lulus 100%)
Sebelum commit atau tagging rilis, jalankan pengujian:
```bash
npm test                                      # Unit test frontend (Vitest)
cargo test --manifest-path src-tauri/Cargo.toml # Unit test Rust backend
npm run build                                 # TypeScript typecheck & production bundle
```

### C. Alur Penerbitan Rilis (GitHub Actions CI/CD)
Rilis produksi resmi untuk distribusi pengguna (installer Windows NSIS dan macOS bundle) dipublikasikan melalui GitHub Actions yang memiliki signing key auto-updater:
1. Commit perubahan versi:
   ```bash
   git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
   git commit -m "chore(release): vX.Y.Z"
   git push origin master
   ```
2. Buat dan push tag rilis (format tag wajib persis `v<versi>`):
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
3. GitHub Actions (`.github/workflows/publish-desktop.yml`) akan otomatis:
   - Membangun installer Windows x64 NSIS (`.exe`).
   - Membangun installer macOS Intel/Universal (`.dmg`, `.app`).
   - Menandatangani paket updater dengan `TAURI_SIGNING_PRIVATE_KEY`.
   - Mengunggah seluruh artefak ke GitHub Releases.

> [!WARNING]
> Jangan menjalankan build rilis produksi lokal ad-hoc sebagai pengganti rilis resmi kecuali jika pengguna secara spesifik hanya meminta executable lokal untuk pengujian manual.

---

## 3. Aturan Teknis Khusus Proyek

### A. Format & Parsing File Gambar / EPS
- File EPS dari Adobe Illustrator memiliki format biner DOS EPS (`0xC5D0D3C6`) yang menyertakan preview TIFF (Palette 8-bit + Alpha) dan XMP thumbnail JPEG.
- Jangan gunakan fallback PostScript vector renderer (`convert_eps_to_svg_data`) pada file Adobe Illustrator karena makro kompleks Illustrator akan menyebabkan gambar dirender hitam pekat (*blank hitam*).
- Selalu pastikan pembersih entitas XML (`&#xA;`, `&#xD;`, dll.) aktif saat mem-parse data base64 XMP.

### B. Keamanan & Lisensi
- Kunci lisensi dikelola via `guardian-core` dan variabel lingkungan `LICENSE_PUBLIC_KEY`.
- Private key updater tidak boleh di-commit ke repositori.
