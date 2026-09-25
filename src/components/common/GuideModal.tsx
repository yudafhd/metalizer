import { BookOpen, ExternalLink, X } from "lucide-react";
import { useState } from "react";

import { openUrl } from "../../services/tauri";

export function GuideModal({ onClose }: { onClose: () => void }) {
  const [osTab, setOsTab] = useState<"windows" | "macos">(() =>
    typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("mac") ? "macos" : "windows"
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/35 p-5 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="flex max-h-[min(88vh,780px)] w-[min(760px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Panduan Penggunaan"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-[16px] font-extrabold text-ink">Panduan Penggunaan</h2>
            </div>
          </div>
          <button className="app-button app-button-quiet h-8 w-8 px-0" onClick={onClose} aria-label="Tutup panduan">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 overflow-y-auto bg-surface-sunken/20 px-6 py-5">
          <div className="space-y-6">
            {/* Section 1: Alur Kerja Utama */}
            <div className="px-1">
              <p className="eyebrow mb-3">Alur Kerja Utama</p>

              <div className="divide-y divide-line">
                {/* 01: Instalasi & Aktivasi */}
                <div className="flex gap-4 py-4 first:pt-0">
                  <span className="min-w-[22px] pt-0.5 font-mono text-[12px] font-bold text-ink-muted">01</span>
                  <div className="flex-1 space-y-2.5">
                    <h3 className="text-[14px] font-bold text-ink">Instalasi & Aktivasi</h3>

                    <div className="inline-flex rounded-lg border border-line bg-surface-sunken p-0.5 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setOsTab("windows")}
                        className={`rounded-md px-3 py-1 transition-all ${
                          osTab === "windows"
                            ? "bg-surface text-ink shadow-sm"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        Windows
                      </button>
                      <button
                        type="button"
                        onClick={() => setOsTab("macos")}
                        className={`rounded-md px-3 py-1 transition-all ${
                          osTab === "macos"
                            ? "bg-surface text-ink shadow-sm"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        macOS
                      </button>
                    </div>

                    {osTab === "windows" ? (
                      <ol className="list-decimal space-y-1.5 pl-4 text-[12px] leading-5 text-ink-secondary">
                        <li>Buka file installer Metalizer (<code>.exe</code>).</li>
                        <li>
                          Jika muncul jendela <em>"Windows protected your PC"</em>, klik teks <strong>More info</strong> lalu pilih tombol <strong>Run anyway</strong> untuk melanjutkan proses instalasi.
                        </li>
                        <li>Buka aplikasi Metalizer, masukkan <strong>Email</strong> pembelian dan <strong>Kode Lisensi</strong> Anda.</li>
                        <li>Klik <strong>Aktivasi</strong>. Lisensi terikat pada 1 perangkat (PC/Laptop).</li>
                      </ol>
                    ) : (
                      <ol className="list-decimal space-y-1.5 pl-4 text-[12px] leading-5 text-ink-secondary">
                        <li>Buka file installer Metalizer (<code>.dmg</code>), lalu seret ikon Metalizer ke folder <strong>Applications</strong>.</li>
                        <li>
                          Buka aplikasi dari folder Applications. Jika muncul peringatan keamanan macOS saat pertama kali dibuka, buka <strong>System Settings &rarr; Privacy & Security</strong>, lalu klik <strong>Open Anyway</strong>.
                        </li>
                        <li>Buka aplikasi Metalizer, masukkan <strong>Email</strong> pembelian dan <strong>Kode Lisensi</strong> Anda.</li>
                        <li>Klik <strong>Aktivasi</strong>. Lisensi terikat pada 1 perangkat (Mac).</li>
                      </ol>
                    )}
                  </div>
                </div>

                {/* 02: Setup Gemini API Key */}
                <div className="flex gap-4 py-4">
                  <span className="min-w-[22px] pt-0.5 font-mono text-[12px] font-bold text-ink-muted">02</span>
                  <div className="flex-1 space-y-2.5">
                    <h3 className="text-[14px] font-bold text-ink">Setup Gemini API Key</h3>
                    <p className="text-[12px] leading-relaxed text-ink-secondary">
                      Metalizer menggunakan AI dari Google Gemini untuk menganalisis visual gambar (tersedia kuota gratis).
                    </p>
                    <ol className="list-decimal space-y-1.5 pl-4 text-[12px] leading-5 text-ink-secondary">
                      <li>
                        Buka{" "}
                        <button
                          type="button"
                          onClick={() => void openUrl("https://aistudio.google.com/app/apikey")}
                          className="inline-flex items-center gap-1 font-semibold text-accent-600 hover:underline"
                        >
                          Google AI Studio <ExternalLink size={11} />
                        </button>{" "}
                        lalu buat API key baru.
                      </li>
                      <li>
                        <div className="my-1 text-[11px] leading-relaxed text-ink-secondary">
                          Panduan langkah demi langkah cara membuat API key dapat dilihat di{" "}
                          <button
                            type="button"
                            onClick={() => void openUrl("https://www.youtube.com/results?search_query=tutorial+membuat+api+key+google+studio")}
                            className="font-semibold text-accent-600 hover:underline"
                          >
                            YouTube
                          </button>{" "}
                          atau{" "}
                          <button
                            type="button"
                            onClick={() => void openUrl("https://www.tiktok.com/search?q=tutorial%20membuat%20api%20key%20google%20studio")}
                            className="font-semibold text-accent-600 hover:underline"
                          >
                            TikTok
                          </button>.
                        </div>
                      </li>
                      <li>Di Metalizer, buka <strong>Settings</strong> (ikon gear kanan atas), masukkan API key, lalu simpan.</li>
                    </ol>
                  </div>
                </div>

                {/* 03: Impor & Generate Metadata */}
                <div className="flex gap-4 py-4">
                  <span className="min-w-[22px] pt-0.5 font-mono text-[12px] font-bold text-ink-muted">03</span>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-[14px] font-bold text-ink">Impor & Generate Metadata</h3>
                    <ol className="list-decimal space-y-1.5 pl-4 text-[12px] leading-5 text-ink-secondary">
                      <li>Tarik gambar atau folder langsung ke Workspace (atau klik <strong>Import Folder</strong>).</li>
                      <li>Format didukung: <code>JPG</code>, <code>PNG</code>, <code>WebP</code>, <code>SVG</code>, dan <code>EPS</code>. File asli Anda tidak akan diubah atau ditimpa.</li>
                      <li>Klik <strong>Generate</strong>. Gambar akan segera diproses.</li>
                    </ol>
                  </div>
                </div>

                {/* 04: Ekspor CSV */}
                <div className="flex gap-4 py-4">
                  <span className="min-w-[22px] pt-0.5 font-mono text-[12px] font-bold text-ink-muted">04</span>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-[14px] font-bold text-ink">Ekspor CSV</h3>
                    <p className="text-[12px] leading-relaxed text-ink-secondary">
                      Fitur ini membuat file metadata CSV untuk Adobe Stock, Shutterstock, Pond5, atau Freepik / Magnific dari aset yang sudah selesai. Format kolom disesuaikan dengan situs yang Anda pilih.
                    </p>
                    <ol className="list-decimal space-y-1.5 pl-4 text-[12px] leading-5 text-ink-secondary">
                      <li>Klik tombol <strong>Export CSV</strong> di pojok kanan atas.</li>
                      <li>Pilih situs tujuan. Untuk Shutterstock, tinjau kategori tiap aset.</li>
                      <li>Pilih lokasi penyimpanan di komputer Anda.</li>
                      <li>Unggah aset dan file CSV lewat portal kontributor situs tujuan.</li>
                    </ol>
                  </div>
                </div>

                {/* 05: Submit ke Adobe Stock */}
                <div className="flex gap-4 py-4 last:pb-0">
                  <span className="min-w-[22px] pt-0.5 font-mono text-[12px] font-bold text-ink-muted">05</span>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-[14px] font-bold text-ink">Submit ke Adobe Stock</h3>
                    <ol className="list-decimal space-y-1.5 pl-4 text-[12px] leading-5 text-ink-secondary">
                      <li>
                        Login ke{" "}
                        <button
                          type="button"
                          onClick={() => void openUrl("https://contributor.stock.adobe.com")}
                          className="inline-flex items-center gap-1 font-semibold text-accent-600 hover:underline"
                        >
                          Adobe Stock Contributor Portal <ExternalLink size={11} />
                        </button>.
                      </li>
                      <li>Unggah file karya Anda di tab <strong>Uploaded Files</strong>.</li>
                      <li>Klik <strong>Upload CSV</strong> dan pilih file CSV yang telah diekspor oleh Metalizer.</li>
                      <li>Semua judul, keyword, dan kategori akan terisi otomatis. Centang opsi Generative AI di website jika karya dibuat dengan AI, lalu klik <strong>Submit</strong>.</li>
                    </ol>
                    <div className="pt-2 text-[11px] leading-relaxed text-ink-secondary">
                      <em>Catatan penting:</em> Nama file dan ekstensi gambar yang diunggah ke Adobe Stock harus sama persis dengan yang ada di dalam CSV agar tidak terjadi error saat pencocokan metadata.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Solusi Kendala (FAQ) */}
            <div className="space-y-3">
              <p className="eyebrow px-1">Solusi Kendala (FAQ)</p>
              <div className="divide-y divide-line">
                <div className="py-3 first:pt-0">
                  <h4 className="text-[13px] font-bold text-ink">Error 429 / Rate Limit (Too Many Requests)</h4>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                    Batas request per menit kuota gratis Gemini tercapai. Di menu <strong>Settings</strong>, turunkan <strong>Request bersamaan</strong> ke <code>1</code> dan naikkan <strong>Jumlah per batch</strong> ke <code>4</code> atau <code>6</code>. Tunggu 1 menit lalu coba lagi.
                  </p>
                </div>

                <div className="py-3">
                  <h4 className="text-[13px] font-bold text-ink">Error "Invalid API Key"</h4>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                    Pastikan API key disalin utuh dari Google AI Studio tanpa spasi tambahan di awal atau akhir.
                  </p>
                </div>

                <div className="py-3">
                  <h4 className="text-[13px] font-bold text-ink">Pindah Perangkat / Laptop Baru</h4>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                    Lisensi terikat ke hardware ID perangkat Anda. Jika Anda mengganti perangkat kerja, hubungi tim support kami untuk reset aktivasi lisensi.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end border-t border-line bg-surface px-6 py-3.5">
          <button className="app-button app-button-primary h-8 px-4 text-[11px]" onClick={onClose}>
            Mengerti
          </button>
        </div>
      </section>
    </div>
  );
}
