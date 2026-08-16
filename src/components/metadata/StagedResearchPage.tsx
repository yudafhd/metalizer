import { FileImage, Sparkles } from "lucide-react";
import { PopulationResearchPanel } from "./PopulationResearchPanel";
import type {
  AdobePopulationAssetType,
  AdobePopulationResearch,
  AdobePopulationSort,
  InitialCandidate,
  PopulationTitleSource,
  StockAsset,
} from "../../types";

interface StagedResearchPageProps {
  assets: StockAsset[];
  selectedAsset?: StockAsset;
  onSelectAsset: (assetId: string) => void;
  candidate?: InitialCandidate;
  research?: AdobePopulationResearch;
  canUseGemini: boolean;
  canSearch: boolean;
  onAnalyzeInitial: () => void;
  onResearch: () => void;
  onAnalyzePopulation: () => void;
  onCancel: () => void;
  onConfigChange: (patch: {
    query?: string;
    locale?: string;
    assetType?: AdobePopulationAssetType;
    sort?: AdobePopulationSort;
    sampleLimit?: number;
  }) => void;
  onChooseTitle: (source: Exclude<PopulationTitleSource, null>) => void;
  onToggleKeyword: (keyword: string) => void;
  onApplyKeywords: () => void;
}

export function StagedResearchPage({
  assets,
  selectedAsset,
  onSelectAsset,
  candidate,
  research,
  canUseGemini,
  canSearch,
  onAnalyzeInitial,
  onResearch,
  onAnalyzePopulation,
  onCancel,
  onConfigChange,
  onChooseTitle,
  onToggleKeyword,
  onApplyKeywords,
}: StagedResearchPageProps) {
  if (!assets.length) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
        <div>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-50 text-accent-600 shadow-sm border border-accent-200">
            <Sparkles size={28} />
          </div>
          <h2 className="mt-4 text-[16px] font-extrabold text-ink">
            Belum ada gambar di Workspace
          </h2>
          <p className="mt-1 max-w-sm text-[12px] leading-5 text-ink-muted">
            Tambahkan gambar terlebih dahulu melalui tombol <b>Tambah Gambar</b> di mode Metadata untuk memulai Research.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 gap-5 overflow-hidden">
      {/* LEFT SECTION (50% Width): Asset Strip + Large Image Canvas Preview */}
      <section className="flex w-1/2 min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
        {/* Asset Strip Selector */}
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-line bg-surface-sunken/40 px-5 overflow-x-auto">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted shrink-0">
            Pilih Aset ({assets.length}):
          </span>
          <div className="flex items-center gap-2">
            {assets.map((asset) => {
              const isSelected = asset.id === selectedAsset?.id;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelectAsset(asset.id)}
                  title={asset.filename}
                  className={`group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition-all ${
                    isSelected
                      ? "border-accent-500 ring-2 ring-accent-400 shadow-sm scale-105"
                      : "border-line-subtle hover:border-accent-300 opacity-70 hover:opacity-100"
                  }`}
                >
                  {asset.previewUrl ? (
                    <img
                      src={asset.previewUrl}
                      alt={asset.filename}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileImage size={16} className="text-ink-muted" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Large Image Preview Area */}
        <div className="flex flex-1 flex-col min-h-0 p-5 overflow-y-auto">
          {selectedAsset ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="truncate text-[14px] font-extrabold text-ink" title={selectedAsset.filename}>
                    {selectedAsset.filename}
                  </h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-ink-muted">
                    {selectedAsset.width} × {selectedAsset.height} px · {formatBytes(selectedAsset.fileSize)} · {selectedAsset.mimeType.replace("image/", "").toUpperCase()}
                  </p>
                </div>
                {candidate ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                    Kandidat Siap
                  </span>
                ) : (
                  <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[10px] font-extrabold text-accent-700 border border-accent-200">
                    Belum Dianalisis
                  </span>
                )}
              </div>

              {/* High-res Image Canvas */}
              <div className="mt-4 flex flex-1 min-h-[300px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-sunken p-4 shadow-inner">
                {selectedAsset.previewUrl ? (
                  <img
                    src={selectedAsset.previewUrl}
                    alt={selectedAsset.filename}
                    className="max-h-full max-w-full rounded-lg object-contain shadow-md"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-ink-muted">
                    <FileImage size={40} className="text-accent-300" />
                    <span className="text-[11px]">Preview gambar tidak tersedia</span>
                  </div>
                )}
              </div>

              {/* Initial Candidate Quick Overview Card */}
              {candidate ? (
                <div className="mt-4 rounded-xl border border-line bg-surface-sunken/40 p-3.5 shadow-sm text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-ink uppercase tracking-wider text-[10px]">
                      Kandidat Subjek & Visual Facts
                    </span>
                    <span className="font-bold text-accent-700 text-[10px]">
                      Confidence {Math.round((candidate.confidence ?? 1) * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 font-semibold text-ink leading-4">
                    {candidate.initialTitle}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {candidate.visualFacts.map((fact) => (
                      <span key={fact} className="tag-chip text-[9px]">
                        {fact}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-[12px] text-ink-muted">
              Pilih salah satu gambar di bagian atas untuk memulai Research.
            </div>
          )}
        </div>
      </section>

      {/* RIGHT SECTION (50% Width): Dedicated Full-Width Population Research Panel */}
      <section className="flex w-1/2 min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-6 bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-[14px] font-extrabold text-ink">
                Adobe Stock Population Research
              </h2>
              <p className="text-[10px] font-medium text-ink-muted">
                Riset populasi bertahap 3-langkah berbasis data pasar Adobe Stock
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <PopulationResearchPanel
            candidate={candidate}
            research={research}
            canUseGemini={canUseGemini}
            canSearch={canSearch}
            onAnalyzeInitial={onAnalyzeInitial}
            onResearch={onResearch}
            onAnalyzePopulation={onAnalyzePopulation}
            onCancel={onCancel}
            onConfigChange={onConfigChange}
            onChooseTitle={onChooseTitle}
            onToggleKeyword={onToggleKeyword}
            onApplyKeywords={onApplyKeywords}
          />
        </div>
      </section>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
