# Metadata Microstock

Standar operasional untuk menyusun metadata stok. Rujukan platform diperiksa pada 25 September 2026. Gunakan empat lapisan sebagai cara mengumpulkan kandidat kata kunci, lalu pilih hanya istilah yang akurat untuk setiap aset.

## Aturan platform yang terverifikasi

| Hal | Adobe Stock | Shutterstock |
| --- | --- | --- |
| Urutan kata kunci | Urutkan berdasarkan relevansi. Sepuluh pertama mendapat bobot terbesar dalam pencarian. | Panduan publik tidak menetapkan bobot berdasarkan posisi. Jangan mengasumsikan semua posisi berbobot sama. |
| Jumlah kata kunci | Maksimal 49; sekitar 15–35 sering cukup bila semuanya relevan. | Minimal 7, maksimal 50. Tidak ada target resmi 25–45. |
| Judul/deskripsi | Singkat, jelas, idealnya di bawah 70 karakter. | Kalimat atau frasa deskriptif yang faktual; batas maksimum 2.048 karakter, bukan 150–200. Judul komersial harus berupa kalimat deskriptif sekurangnya lima kata. |
| Lokasi dan kategori | Pilih kategori yang sesuai dengan subjek; hindari lokasi yang tidak dapat dipastikan. | Satu kategori wajib, kategori kedua opsional. Kolom lokasi opsional dan harus akurat jika diisi. Judul konten editorial dokumenter memiliki ketentuan tanggal dan lokasi tersendiri. |

Sumber: [judul dan kata kunci Adobe](https://helpx.adobe.com/stock/contributor/content-policies-guidelines/metadata/tips-effective-titles-keywords.html), [panduan jumlah dan relevansi Adobe](https://helpx.adobe.com/stock/contributor/help/artist-hub-migration/maximize-metadata-to-get-discovered.html), [standar metadata Shutterstock](https://submit.shutterstock.com/help/en/articles/10617427-content-publishing-standards-contextual-metadata), [praktik judul dan kata kunci Shutterstock](https://submit.shutterstock.com/help/en/articles/10594702-description-and-keyword-best-practices), [persyaratan judul komersial Shutterstock](https://submit.shutterstock.com/help/en/articles/12136367-why-was-my-content-rejected-for-title-or-keywords).

## Prosedur empat lapisan

1. **Literal:** catat subjek, objek, atribut, dan aksi yang terlihat. Ini sumber utama kata kunci paling penting.
2. **Kontekstual:** catat latar, interaksi, waktu, dan keadaan yang didukung gambar atau frame video.
3. **Konseptual dan emosional:** catat tema atau suasana yang benar-benar tergambar. Hindari menebak profesi, identitas, kondisi medis, atau kegunaan bisnis hanya dari objek umum.
4. **Gaya dan teknis visual:** catat sudut pandang, pencahayaan, ruang salin, atau gerak kamera yang dapat diamati. Jangan menambahkan spesifikasi kamera yang tidak diketahui.

Jumlah per lapisan adalah panduan untuk mengumpulkan ide, bukan kuota. Gabungkan kandidat, hapus pengulangan dan variasi yang tidak memberi makna baru, lalu berhenti ketika istilah berikutnya tidak lagi menambah relevansi. Adobe menyarankan menghindari variasi singular/jamak dan sinonim berlebihan karena pencariannya sudah menangani sinonim dasar. [Sumber Adobe](https://helpx.adobe.com/stock/contributor/help/artist-hub-migration/maximize-metadata-to-get-discovered.html).

## Urutan kerja per aset

1. Tulis judul yang menjelaskan subjek dan aksi utama secara natural. Untuk Adobe, jaga sekitar 70 karakter atau kurang. Untuk Shutterstock, buat deskripsi faktual yang cukup lengkap; jangan memanjangkan kalimat demi jumlah karakter.
2. Susun kandidat dari empat lapisan. Periksa setiap istilah terhadap aset yang sedang dikerjakan, terutama saat memproses batch.
3. Untuk Adobe, urutkan kata kunci berdasarkan pentingnya bagi pembeli. Tempatkan subjek, aksi, dan konsep utama pada sepuluh posisi pertama; sertakan istilah penting dari judul jika relevan. Konsep yang menjadi inti gambar boleh berada di sepuluh besar. Periksa urutan lagi setelah ekspor atau impor ke portal.
4. Untuk Shutterstock, gunakan kumpulan istilah relevan yang sama sebagai titik awal, lalu sesuaikan deskripsi, kategori, dan lokasi sesuai aturan platform. Jangan mengandalkan urutan sebagai faktor peringkat yang sudah terbukti.
5. Hapus kata kunci tidak relevan, promosi, merek dagang tanpa hak, dan pengulangan. Periksa ejaan, bahasa akun, serta syarat editorial sebelum mengirim.

## Batas klaim optimasi

- Sepuluh kata kunci pertama Adobe **lebih berbobot**, tetapi bukan satu-satunya penentu peringkat dan tidak menjamin penjualan.
- Tidak ada dasar publik untuk angka penurunan visibilitas yang pasti atau penalti “langsung” dari satu kata kunci. Metadata yang menyesatkan dapat mengurangi relevansi dan bahkan menyebabkan penolakan; Shutterstock juga melarang pengulangan dan istilah tidak relevan. [Adobe](https://helpx.adobe.com/stock/contributor/help/artist-hub-migration/maximize-metadata-to-get-discovered.html) · [Shutterstock](https://submit.shutterstock.com/help/en/articles/10594702-description-and-keyword-best-practices).
- Mengedit portofolio lama dapat dicoba dan hasilnya perlu diukur. Perubahan judul atau urutan kata kunci tidak menjamin peningkatan unduhan; hasil pencarian melibatkan banyak faktor. [Penjelasan Shutterstock](https://submit.shutterstock.com/help/en/articles/10594560-what-determines-order-of-content-in-search-results).

## Penerapan di Metalizer

Metalizer saat ini menghasilkan metadata dan CSV untuk **Adobe Stock**. Prompt menargetkan 15–35 kata kunci yang didukung aset, mengutamakan sepuluh pertama, dan Inspector memungkinkan pengurutan manual. Aplikasi mempertahankan urutan kata kunci dari hasil AI saat membersihkan duplikat dan istilah tidak aman. Sebelum ekspor, periksa lagi sepuluh kata kunci pertama. Nilai kualitas yang ditampilkan aplikasi adalah indikator internal, bukan skor peringkat resmi Adobe atau Shutterstock.

Panduan Shutterstock di dokumen ini berlaku untuk penyuntingan metadata di luar alur ekspor Adobe yang tersedia sekarang.
