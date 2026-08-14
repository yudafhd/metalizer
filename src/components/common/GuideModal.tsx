import { BookOpen, CheckCircle2, Info, X } from "lucide-react";

interface GuideSection {
  title: string;
  description: string;
  items: { label: string; detail: string }[];
}

const guideSections: GuideSection[] = [
  {
    title: "Mulai dari sini",
    description: "Urutan paling mudah untuk membuat metadata dari gambar.",
    items: [
      { label: "1. Masukkan gambar", detail: "Klik Tambah gambar untuk memilih beberapa file, Tambah folder untuk mengambil semua gambar dari satu folder, atau seret gambar langsung ke Workspace." },
      { label: "2. Buat metadata", detail: "Klik Generate setelah API key tersambung. Metalizer akan membaca gambar dan membuat judul, kata kunci, serta kategori." },
      { label: "3. Periksa hasil", detail: "Klik satu baris gambar untuk membuka panel Inspector di sebelah kanan. Perbaiki bagian yang masih kurang sesuai." },
      { label: "4. Export", detail: "Jika semua hasil sudah siap, klik Export CSV untuk membuat file yang dapat diunggah ke Adobe Stock." },
    ],
  },
  {
    title: "Header dan tombol utama",
    description: "Semua perintah penting untuk memulai dan menyelesaikan pekerjaan.",
    items: [
      { label: "Metalizer · versi", detail: "Menunjukkan nama dan versi aplikasi yang sedang digunakan." },
      { label: "Tambah gambar / Tambah folder", detail: "Menambahkan gambar satu per satu, beberapa sekaligus, atau seluruh gambar dalam folder." },
      { label: "Metadata mode", detail: "Strict membuat hasil lebih aman dan spesifik. Balanced memberi hasil yang seimbang. Discovery lebih terbuka untuk mencari kemungkinan kata kunci." },
      { label: "Generate", detail: "Memulai proses pembuatan metadata dengan Gemini. Tombol ini aktif jika ada gambar, internet, dan API key yang sudah diuji." },
      { label: "Export CSV", detail: "Menyimpan metadata yang sudah selesai ke file CSV. Gambar asli tidak diubah." },
      { label: "Pengaturan", detail: "Membuka pengaturan API key, model AI, ukuran batch, dan pilihan pemrosesan gambar." },
      { label: "Panduan", detail: "Membuka penjelasan ini kapan saja." },
    ],
  },
  {
    title: "Workspace",
    description: "Tempat untuk melihat semua gambar dan memantau hasilnya.",
    items: [
      { label: "Baris gambar", detail: "Setiap baris menampilkan preview, nama file, judul, jumlah keyword, kategori, dan nilai kualitas." },
      { label: "Memilih gambar", detail: "Klik baris untuk mengedit satu gambar. Gunakan kotak centang untuk memilih beberapa gambar dan menjalankan perubahan bersama-sama." },
      { label: "Status", detail: "Queued berarti menunggu, Preparing sedang menyiapkan gambar, Processing sedang meminta bantuan AI, Completed selesai, dan Failed perlu dicoba lagi." },
      { label: "Hapus selesai / Hapus semua", detail: "Hapus selesai menghapus gambar yang sudah selesai dari Workspace. Hapus semua mengosongkan seluruh Workspace, tetapi tidak menghapus file asli." },
      { label: "Coba lagi", detail: "Mencoba lagi gambar yang gagal diproses." },
      { label: "Perubahan bersama", detail: "Setelah beberapa gambar dipilih, Anda dapat mengubah kategori, menambah atau menghapus kata kunci, lalu melakukan Regenerate." },
    ],
  },
  {
    title: "Inspector dan metadata",
    description: "Panel kanan untuk membaca dan mengedit hasil satu gambar.",
    items: [
      { label: "Preview dan nilai kualitas", detail: "Menampilkan gambar, ukuran file, jenis file, dan nilai perkiraan kualitas metadata. Nilai ini membantu menemukan hasil yang perlu diperiksa, bukan keputusan akhir Adobe Stock." },
      { label: "Title", detail: "Judul singkat yang menjelaskan isi gambar. Perhatikan penghitung karakter agar judul tetap sesuai batas yang ditampilkan." },
      { label: "Kategori", detail: "Pilih kategori Adobe Stock yang paling cocok dengan isi utama gambar." },
      { label: "Keywords", detail: "Gunakan kata yang benar-benar terlihat atau relevan. Sepuluh kata pertama dianggap paling penting; seret untuk mengubah urutannya." },
      { label: "Sumber konten", detail: "Penanda yang bisa Anda pilih sendiri untuk mencatat apakah konten biasa atau AI generatif. Metalizer tidak menebak asal gambar." },
      { label: "Urungkan dan Generate ulang", detail: "Urungkan mengembalikan metadata sebelumnya. Generate ulang dapat dijalankan hanya untuk Title, Keywords, atau semua metadata." },
      { label: "Perlu dicek", detail: "Peringatan yang perlu Anda periksa sebelum export, misalnya judul terlalu panjang atau keyword kurang sesuai." },
    ],
  },
  {
    title: "Settings dan koneksi Gemini",
    description: "Pengaturan yang mengatur cara AI bekerja.",
    items: [
      { label: "Gemini API key", detail: "Kunci untuk menghubungkan Metalizer ke Gemini. Kunci disimpan secara aman di aplikasi desktop, bukan di file metadata." },
      { label: "Tes dan Simpan", detail: "Tes memeriksa apakah key dapat digunakan. Simpan menyimpan key dan langsung mengecek koneksi." },
      { label: "Model AI", detail: "Seimbang cocok untuk penggunaan umum. Cepat mengutamakan kecepatan. Model khusus hanya digunakan jika Anda tahu nama model yang tersedia." },
      { label: "Jumlah per batch", detail: "Jumlah gambar yang dikirim dalam satu request. Nilai lebih besar biasanya lebih cepat, tetapi hasil tetap perlu diperiksa." },
      { label: "Request bersamaan", detail: "Jumlah request yang berjalan bersamaan. Jika sering terkena batas kuota, gunakan angka yang lebih kecil." },
      { label: "Gaya metadata dan jumlah keyword", detail: "Mengatur gaya hasil AI dan jumlah keyword yang ingin dibuat. Jumlah akhir tetap dapat berubah setelah validasi." },
      { label: "Pemrosesan gambar", detail: "Mengatur kualitas contact sheet, ukuran maksimum, dan warna latar gambar yang dikirim untuk dibaca AI. Ini tidak mengubah gambar asli." },
      { label: "Sertakan kolom Releases", detail: "Menambahkan kolom Releases kosong pada CSV jika Anda ingin mengisinya untuk kebutuhan pengiriman." },
    ],
  },
  {
    title: "Pemakaian Gemini dan kondisi offline",
    description: "Informasi agar Anda tahu apa yang sedang terjadi.",
    items: [
      { label: "Gemini usage today", detail: "Menampilkan jumlah request dan token yang berhasil dicatat Metalizer pada hari ini. Data ini disimpan lokal dan direset saat tanggal berganti." },
      { label: "Bukan angka sisa kuota Google", detail: "Angka lokal tidak menghitung pemakaian dari aplikasi lain yang memakai project Gemini yang sama. Untuk batas resmi, periksa Google AI Studio." },
      { label: "Offline", detail: "Saat internet terputus, Anda tetap dapat mengedit metadata dan export CSV. Pembuatan metadata baru akan menunggu sampai koneksi tersedia." },
      { label: "Keamanan file", detail: "Metalizer hanya membaca gambar untuk membuat metadata. File gambar asli tidak dipindahkan atau ditimpa." },
    ],
  },
];

export function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-5 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="flex max-h-[min(88vh,820px)] w-[min(900px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-raspberry-100 bg-surface shadow-2xl" role="dialog" aria-modal="true" aria-label="Panduan Metalizer">
        <div className="flex shrink-0 items-center justify-between border-b border-raspberry-100 bg-surface px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-raspberry-50 text-raspberry-600"><BookOpen size={19} /></div>
            <div>
              <p className="eyebrow">Metalizer v0.1.0</p>
              <h2 className="mt-1 text-[17px] font-extrabold text-slate-900">Panduan penggunaan</h2>
            </div>
          </div>
          <button className="app-button app-button-quiet h-8 w-8 px-0" onClick={onClose} aria-label="Tutup panduan"><X size={18} /></button>
        </div>

        <div className="min-h-0 overflow-y-auto bg-raspberry-50/20 px-6 py-5">
          <div className="rounded-2xl border border-raspberry-200 bg-raspberry-50/70 p-4">
            <div className="flex items-start gap-3">
              <Info size={17} className="mt-0.5 shrink-0 text-raspberry-600" />
              <p className="text-[12px] leading-5 text-slate-700">Metalizer membantu menyiapkan metadata microstock dari gambar. AI memberi saran awal, tetapi Anda tetap menjadi pemeriksa terakhir sebelum file dikirim ke Adobe Stock.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {guideSections.map((section) => (
              <article key={section.title} className="rounded-2xl border border-raspberry-100 bg-surface p-5 shadow-sm">
                <h3 className="text-[14px] font-extrabold text-slate-900">{section.title}</h3>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{section.description}</p>
                <div className="mt-4 divide-y divide-raspberry-50">
                  {section.items.map((item) => (
                    <div key={item.label} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-raspberry-500" />
                      <div>
                        <p className="text-[11px] font-extrabold text-slate-800">{item.label}</p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-600">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-raspberry-100 bg-surface px-6 py-3.5">
          <p className="text-[10px] font-medium text-slate-500">Gunakan panduan ini kapan saja melalui tombol Panduan di header.</p>
          <button className="app-button app-button-primary h-8 px-3 text-[11px]" onClick={onClose}>Mengerti</button>
        </div>
      </section>
    </div>
  );
}
