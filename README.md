# Metalizer — Microstock Metadata

Metalizer adalah aplikasi desktop **local-first** untuk membuat, meninjau, memvalidasi, dan mengekspor metadata gambar secara batch untuk Adobe Stock. Metalizer menggunakan Gemini untuk membuat saran `Title`, `Keywords`, dan `Category`; keputusan akhir dan pemeriksaan metadata tetap berada di tangan pengguna.

> Versi saat ini: `0.2.0`


## Fitur

- Impor banyak file atau seluruh folder secara rekursif.
- Mendukung `JPG`, `JPEG`, `PNG`, `WebP`, dan `SVG`.
- Pemrosesan batch 1–6 gambar menggunakan contact sheet.
- Tiga gaya pembuatan metadata: **Ketat**, **Seimbang**, dan **Eksplorasi**.
- Pemeriksaan keyword: duplikat, keyword berisiko, urutan relevansi, dan jumlah keyword.
- Inspector untuk mengedit title, category, keyword, dan sumber konten per gambar.
- Bulk edit untuk mengubah kategori atau keyword beberapa gambar sekaligus.
- Generate ulang hanya untuk title, keywords, atau seluruh metadata.
- Nilai kualitas dan peringatan sebelum export.
- Export CSV UTF-8 dengan format Adobe Stock, termasuk opsi kolom `Releases`.
- API key disimpan di Tauri Stronghold, bukan di `localStorage` atau file `.env`.
- File gambar asli tidak dipindahkan atau ditimpa.

## Teknologi

- Tauri v2 + Rust
- React 19 + TypeScript + Vite
- Tailwind CSS
- Gemini API
- Tauri Stronghold untuk API key
- Tauri Store untuk preferensi aplikasi
- Rust `image` untuk contact sheet
- Rust `csv` untuk CSV yang aman terhadap koma dan tanda kutip

## Lisensi aplikasi

Metalizer memakai [`guardian-core`](https://github.com/yudafhd/guardian-core) untuk aktivasi lisensi berbasis email. Kode lisensi diverifikasi di Rust, terikat ke perangkat, dan status masa aktif dapat dicek tanpa koneksi internet.

### Membuat key dan kode lisensi

Semua langkah berikut dijalankan dari folder project Metalizer. `guardian-core` hanya digunakan sebagai tool penerbit lisensi dan tidak perlu dipindahkan ke dalam project ini.

1. Masuk ke folder project:

```bash
cd /path/ke/metalizer
```

Windows PowerShell:

```powershell
cd D:\Work\Projects\metalizer
```

2. Clone `guardian-core` ke folder sebelah project jika belum ada:

```bash
if [ ! -f ../guardian-core/Cargo.toml ]; then
  git clone https://github.com/yudafhd/guardian-core.git ../guardian-core
fi
```

Di Windows PowerShell, gunakan:

```powershell
if (-not (Test-Path "..\guardian-core\Cargo.toml")) {
  git clone https://github.com/yudafhd/guardian-core.git ..\guardian-core
}
```

3. Buat keypair PEM di folder `license-keys`:

Linux/macOS:

```bash
npm run license:keygen
```

Windows PowerShell:

```powershell
npm run license:keygen
```

Hasilnya adalah `private.pem` dan `public.pem`. Jangan commit atau membagikan `private.pem`.

4. Buat kode lisensi untuk pelanggan. Product code harus sama dengan `LICENSE_PRODUCT_CODE` pada `.env`:

```bash
npm run license:create -- --email customer@example.com --days 2 --years 1 --private-key ./license-keys/private.pem
```

Windows PowerShell:

```powershell
npm run license:create -- --email customer@example.com --days 2 --years 1 --private-key .\license-keys\private.pem
```

Salin output kode kepada pelanggan. Email pada kode harus sama dengan email yang digunakan saat aktivasi.

Untuk lisensi lifetime, ganti `--years 1` dengan `--perpetual`.

5. Buat `.env` di folder project Metalizer:

Linux/macOS:

```bash
LICENSE_PRODUCT_CODE=metalizer
LICENSE_PUBLIC_KEY=G_PFk34zeiSgATeg6mgEpdvzp5BzEj8KdpbdYY1drCs
```

Windows PowerShell:

```powershell
$env:LICENSE_PRODUCT_CODE = "metalizer"
$env:LICENSE_PUBLIC_KEY = "G_PFk34zeiSgATeg6mgEpdvzp5BzEj8KdpbdYY1drCs"
```

6. Build Metalizer dari folder project:

```bash
npm install
npm run tauri build
```

Hanya public key raw yang boleh di-embed ke aplikasi; `private.pem` hanya digunakan operator saat menerbitkan kode lisensi. Saat aktivasi, aplikasi memvalidasi signature secara lokal dan menggunakan waktu terpercaya dari `time.now` bila tersedia, dengan fallback ke cache atau waktu sistem.

Product ID default adalah `metalizer`, sesuai konfigurasi aplikasi.

## Prasyarat pengembangan

Pasang hal berikut sebelum menjalankan proyek:

- Node.js dan npm
- Rust dan Cargo
- Prasyarat Tauri sesuai sistem operasi, termasuk WebView/WebView2

Detail prasyarat Tauri dapat dilihat pada dokumentasi resmi Tauri sesuai sistem operasi yang digunakan.

## Instalasi dan menjalankan aplikasi

Di folder proyek, jalankan:

```bash
npm install
npm run tauri dev
```

Untuk menjalankan frontend saja di browser:

```bash
npm run dev
```

Mode browser berguna untuk melihat antarmuka, tetapi fitur yang membutuhkan runtime desktop—seperti pemilihan file lokal, pemrosesan gambar Rust, Stronghold, dan generate Gemini—memerlukan `npm run tauri dev`.

Untuk membuat bundle produksi:

```bash
npm run tauri build
```

Hasil bundle akan dibuat oleh Tauri di folder `src-tauri/target/release/bundle/`.

## Rilis GitHub

Build CI berjalan saat ada push ke `master` dan hanya mengunggah artifact. Untuk menerbitkan rilis, naikkan versi yang sama di `package.json`, `src-tauri/Cargo.toml`, dan `src-tauri/tauri.conf.json`, lalu push commit tersebut ke branch `release` atau jalankan workflow **Publish desktop release** secara manual.

Workflow publish memverifikasi ketiga versi, membangun NSIS Windows serta DMG/app macOS Intel dan Apple Silicon, membuat tag `v<version>`, lalu membuat GitHub Release. Repository secret `LICENSE_PUBLIC_KEY` wajib berisi public key lisensi raw base64url.

Metalizer juga mendukung auto-update bertanda tangan melalui `latest.json` pada GitHub Release. Tambahkan secret berikut sebelum menerbitkan rilis pertama:

- `TAURI_SIGNING_PRIVATE_KEY`: isi file lokal `updater-keys/metalizer-updater.key`.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: opsional; kosongkan jika key dibuat tanpa password.

Public key updater sudah ditanam di `src-tauri/tauri.conf.json`. Jangan commit folder `updater-keys` atau membagikan private key tersebut.

## Tutorial penggunaan

### 1. Siapkan Gemini API key

1. Buka aplikasi Metalizer.
2. Klik **Settings**.
3. Pada bagian **Koneksi AI**, tempel Gemini API key.
4. Klik **Tes** untuk memeriksa koneksi.
5. Klik **Simpan**.

Generate hanya dapat dijalankan jika API key sudah tersimpan, koneksi berhasil diuji, dan aplikasi sedang online. API key disimpan secara lokal di vault Stronghold.

### 2. Masukkan gambar

Pilih salah satu cara berikut:

- Klik **Pilih gambar** atau **Tambah gambar** untuk memilih satu atau beberapa gambar.
- Klik **Tambah folder** untuk memindai gambar dari sebuah folder secara rekursif.
- Seret gambar ke area workspace.

File yang didukung adalah `JPG`, `JPEG`, `PNG`, `WebP`, dan `SVG`. File duplikat, rusak, atau tidak didukung akan dilewati. Gambar asli hanya dibaca dan tidak diubah. SVG dirender sementara untuk preview dan analisis AI; file asli tetap tidak diubah.

### 3. Atur opsi generate

Sebelum membuat metadata, buka **Settings** bila ingin mengubah:

- **Model AI**: `Seimbang`, `Cepat`, atau model khusus.
- **Jumlah per batch**: 1–6 gambar dalam satu contact sheet.
- **Request bersamaan**: 1–3 request berjalan paralel.
- **Gaya metadata**: ketat, seimbang, atau eksplorasi.
- **Jumlah keywords**: target 20–35 keyword yang relevan.
- **Pemrosesan gambar**: kualitas, ukuran maksimum, dan latar contact sheet.

Mode metadata juga dapat diubah langsung dari pilihan mode di header.

### 4. Generate metadata

Klik **Generate**. Metalizer akan:

1. Mengelompokkan gambar sesuai ukuran batch.
2. Membuat contact sheet tanpa memotong atau meregangkan gambar.
3. Mengirim contact sheet ke Gemini dengan pemetaan ID panel internal.
4. Memeriksa agar setiap hasil kembali ke file yang benar.
5. Menormalisasi keyword, menghitung nilai kualitas, dan menampilkan peringatan.

Jika request sementara gagal, aplikasi akan mencoba ulang. Gambar yang gagal dapat diproses kembali melalui **Coba lagi**.

### 5. Tinjau dan edit hasil

Klik baris gambar untuk membuka **Inspector**. Periksa:

- **Title**: judul singkat dan deskriptif.
- **Keywords**: pastikan benar-benar didukung isi gambar. Sepuluh keyword pertama paling penting.
- **Category**: pilih kategori Adobe Stock yang paling sesuai.
- **Sumber konten**: pilih `Biasa` atau `AI generatif` sebagai penanda manual.
- **Peringatan**: selesaikan masalah penting sebelum export.

Gunakan tombol berikut bila diperlukan:

- **Urungkan** untuk mengembalikan metadata sebelumnya.
- **Title**, **Keywords**, atau **Semua** untuk generate ulang sebagian atau seluruh metadata.
- Checkbox beberapa gambar untuk mengubah kategori, menambah/menghapus keyword, atau generate ulang secara massal.

### 6. Export CSV

1. Pastikan metadata semua gambar sudah selesai dan tidak memiliki error validasi.
2. Klik **Export CSV**.
3. Pilih lokasi penyimpanan.
4. Jika ada peringatan, pilih **Cek dulu** untuk memperbaiki atau **Tetap export** untuk melanjutkan.

CSV memiliki header utama:

```text
Filename,Title,Keywords,Category
```

Jika opsi **Sertakan kolom Releases** aktif, kolom `Releases` juga ditambahkan. Export besar dapat dibagi otomatis menjadi beberapa file. Metalizer hanya membuat CSV; proses upload ke Adobe Stock dilakukan secara terpisah.

## Status dan kondisi offline

- **Queued**: menunggu diproses.
- **Preparing**: contact sheet sedang disiapkan.
- **Processing**: request AI sedang berjalan.
- **Completed**: metadata selesai.
- **Failed**: proses gagal dan dapat dicoba lagi.

Saat offline, metadata yang sudah ada tetap dapat diedit dan diekspor. Generate AI memerlukan koneksi internet.

## Keamanan dan privasi

- API key disimpan di vault Tauri Stronghold.
- API key tidak disimpan di `localStorage`, `.env`, atau CSV.
- Contact sheet bersifat sementara dan dibersihkan setelah request.
- Tidak ada login Adobe, database cloud, telemetry, scraping, atau upload otomatis.
- File asli tidak dipindahkan, ditimpa, atau dihapus oleh Metalizer.

## Pengujian

```bash
npm run build
npm test
```

Test mencakup batching 1, 6, 13, dan 100 gambar, pemetaan panel, normalisasi keyword, validasi, scoring kualitas, serta escaping CSV.

## Lisensi

Lihat [LICENSE](LICENSE).
