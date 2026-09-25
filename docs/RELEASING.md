# Panduan Rilis

Dokumen ini menjelaskan cara menerbitkan rilis desktop Metalizer melalui GitHub Actions.

## Hasil rilis

Workflow **Publish desktop release** membuat GitHub Release berisi:

- Installer Windows x64 dalam format NSIS.
- Bundle macOS Intel dalam format `.dmg` dan `.app`.

Workflow ini tidak membangun macOS Apple Silicon atau executable Windows portable. Job macOS berjalan di runner macOS dan menargetkan `x86_64-apple-darwin`; job Windows berjalan di `windows-latest`.

Rilis juga menyiapkan metadata update bertanda tangan yang digunakan fitur auto-update Metalizer.

## Prasyarat satu kali

Pastikan repository GitHub memiliki secrets berikut sebelum menjalankan rilis:

- `LICENSE_PUBLIC_KEY`: kunci publik lisensi raw base64url, tepat 32 byte (biasanya 43 karakter tanpa padding). Workflow memvalidasi format dan panjangnya.
- `TAURI_SIGNING_PRIVATE_KEY`: private key updater Tauri. Workflow mewajibkan nilai ini untuk menandatangani artefak update.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: password private key updater jika key dibuat dengan password. Biarkan kosong jika key tidak memakai password.

Public key updater sudah berada di `src-tauri/tauri.conf.json`. Simpan private key dengan aman dan jangan commit file private key atau folder `updater-keys` ke repository.

## Persiapan setiap rilis

1. Perbarui nomor versi ke nilai yang sama di `package.json`, `src-tauri/Cargo.toml`, dan `src-tauri/tauri.conf.json`.
2. Pastikan perubahan rilis sudah masuk ke commit/branch yang akan dirilis.
3. Pastikan test frontend dan Rust lulus. Workflow akan menjalankan `npm test` dan `cargo test --manifest-path src-tauri/Cargo.toml`; CI pada pull request atau push ke `master` juga menjalankan typecheck frontend.

Workflow memeriksa konsistensi ketiga nomor versi. Untuk pemicu dengan tag, nama tag wajib persis `v<versi>`; misalnya versi `1.2.3` harus menggunakan tag `v1.2.3`.

## Menjalankan rilis

Pilih salah satu cara berikut:

### Dengan tag

Push tag versi ke GitHub:

```bash
git tag v1.2.3
git push origin v1.2.3
```

Ganti `1.2.3` dengan versi yang sudah disetel di ketiga file versi. Pastikan tag menunjuk ke commit yang berisi perubahan rilis.

### Secara manual

1. Buka repository GitHub, lalu pilih **Actions**.
2. Pilih workflow **Build & publish desktop release** / **Publish desktop release**.
3. Klik **Run workflow**, pilih branch atau ref yang berisi perubahan rilis, lalu jalankan.

Untuk pemicu manual, workflow tetap membuat atau memperbarui release dengan tag `v<versi>` yang dibaca dari file proyek. Pastikan ref yang dipilih adalah commit yang tepat dan tag versi tersebut belum dipakai oleh rilis lain.

## Memeriksa hasil

Tunggu kedua job matrix selesai dengan status berhasil, lalu buka GitHub Release `v<versi>`. Periksa bahwa aset installer Windows NSIS dan bundle macOS Intel tersedia. Jika salah satu job gagal, buka log job terkait di Actions; workflow akan berhenti jika secret tidak tersedia, versi tidak cocok, atau test/build gagal.

## Workflow CI

Workflow **Continuous integration** berjalan pada pull request dan push ke `master`. Ia menjalankan typecheck frontend, test frontend, dan test Rust di Linux. CI tidak menerbitkan release dan tidak menghasilkan installer desktop.
