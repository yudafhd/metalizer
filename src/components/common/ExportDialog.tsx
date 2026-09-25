import { Download, LoaderCircle } from "lucide-react";
import { EXPORT_PLATFORMS, SHUTTERSTOCK_CATEGORIES, suggestShutterstockCategory } from "../../constants/exportPlatforms";
import type { CsvExportPlatform, StockAsset } from "../../types";

const VIDEO_UNAVAILABLE_CATEGORIES = new Set(["Abstract", "Beauty/Fashion", "Celebrities", "Interiors", "Miscellaneous", "Parks/Outdoor", "Vintage"]);

interface Props {
  assets: StockAsset[];
  issues: string[];
  platform: CsvExportPlatform;
  categories: Record<string, string>;
  exporting: boolean;
  onPlatformChange: (platform: CsvExportPlatform) => void;
  onCategoryChange: (assetId: string, category: string) => void;
  onClose: () => void;
  onExport: () => void;
}

export function ExportDialog({ assets, issues, platform, categories, exporting, onPlatformChange, onCategoryChange, onClose, onExport }: Props) {
  const ready = assets.filter((asset) => asset.status === "completed" && asset.metadata && (platform !== "freepik" || asset.mediaType !== "video"));
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="w-full max-w-[640px] rounded-2xl border border-line bg-surface p-6 shadow-modal">
        <h2 id="export-title" className="text-[17px] font-extrabold text-ink">Export CSV metadata</h2>
        <p className="mt-1 text-[12px] text-ink-secondary">{ready.length} aset selesai siap diekspor. Pilih format situs tujuan.</p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EXPORT_PLATFORMS.map((item) => (
            <button key={item.id} type="button" onClick={() => onPlatformChange(item.id)} aria-pressed={platform === item.id}
              className={`rounded-xl border px-3 py-3 text-left text-[12px] font-bold transition-colors ${platform === item.id ? "border-accent-500 bg-accent-500/10 text-accent-500" : "border-line text-ink hover:border-accent-500/50"}`}>
              {item.name}
            </button>
          ))}
        </div>

        {platform === "shutterstock" ? (
          <div className="mt-4">
            <p className="text-[12px] leading-5 text-ink-secondary">Kategori di bawah hanya saran dari kategori Adobe. Periksa kesesuaiannya untuk setiap aset. Kolom Description memakai judul aset saat ini.</p>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line">
              {ready.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0">
                  <span className="min-w-0 truncate text-[11px] text-ink" title={asset.filename}>{asset.filename}</span>
                  <select aria-label={`Kategori Shutterstock untuk ${asset.filename}`} value={categories[asset.id] ?? suggestShutterstockCategory(asset.metadata!.category)}
                    onChange={(event) => onCategoryChange(asset.id, event.target.value)}
                    className="w-44 shrink-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] text-ink">
                    {SHUTTERSTOCK_CATEGORIES.filter((category) => asset.mediaType !== "video" || !VIDEO_UNAVAILABLE_CATEGORIES.has(category)).map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ) : platform === "freepik" ? (
          <p className="mt-4 text-[12px] leading-5 text-ink-secondary">Freepik / Magnific menggunakan titik koma antar kolom dan koma antar keyword. Hanya aset gambar yang disertakan; video dilewati.</p>
        ) : platform === "pond5" ? (
          <p className="mt-4 text-[12px] leading-5 text-ink-secondary">Pond5 mengekspor tiga kolom wajib: OriginalFilename, Title, dan Keywords.</p>
        ) : (
          <p className="mt-4 text-[12px] leading-5 text-ink-secondary">Adobe Stock memakai urutan keyword dan kategori numerik yang sudah tersimpan. Kolom Releases mengikuti pengaturan aplikasi.</p>
        )}

        {issues.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-ink">
            <p className="font-bold">{issues.length} aset perlu diperiksa; hanya aset selesai yang diekspor.</p>
            <div className="mt-1 max-h-24 overflow-y-auto">{issues.slice(0, 12).map((issue, index) => <p key={`${index}-${issue}`} className="py-0.5">{issue}</p>)}{issues.length > 12 ? <p>+ {issues.length - 12} lainnya</p> : null}</div>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2.5">
          <button className="app-button" disabled={exporting} onClick={onClose}>Batal</button>
          <button className="app-button app-button-primary" disabled={exporting || ready.length === 0} onClick={onExport}>
            {exporting ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />} Export {EXPORT_PLATFORMS.find((item) => item.id === platform)?.name}
          </button>
        </div>
      </div>
    </div>
  );
}
