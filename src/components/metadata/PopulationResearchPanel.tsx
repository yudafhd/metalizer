import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  LoaderCircle,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { openUrl, onPopulationSearchProgress } from "../../services/tauri";
import type {
  AdobePopulationAssetType,
  AdobePopulationResearch,
  AdobePopulationSort,
  InitialCandidate,
  PopulationSearchProgressPayload,
  PopulationTitleSource,
} from "../../types";

interface PopulationResearchPanelProps {
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

export function PopulationResearchPanel({
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
}: PopulationResearchPanelProps) {
  const [copied, setCopied] = useState(false);
  const [aiResponseCopied, setAiResponseCopied] = useState(false);

  // Determine the furthest / naturally active step
  const naturalStep: 1 | 2 | 3 = !candidate
    ? 1
    : !research || research.status === "idle" || research.status === "searching"
    ? 2
    : 3;

  const [selectedStep, setSelectedStep] = useState<1 | 2 | 3>(naturalStep);
  const [searchProgress, setSearchProgress] = useState<PopulationSearchProgressPayload | null>(null);

  // Subscribe to real-time per-link population search progress
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onPopulationSearchProgress((payload) => {
      if (!candidate || payload.assetId === candidate.assetId) {
        setSearchProgress(payload);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, [candidate]);

  // Auto-sync selectedStep when the research status naturally progresses
  useEffect(() => {
    setSelectedStep(naturalStep);
  }, [naturalStep]);

  useEffect(() => {
    if (research?.status !== "searching") {
      const timeout = window.setTimeout(() => {
        if (research?.status !== "searching") {
          setSearchProgress(null);
        }
      }, 2000);
      return () => window.clearTimeout(timeout);
    }
  }, [research?.status]);

  const busy =
    research?.status === "initializing" ||
    research?.status === "searching" ||
    research?.status === "analyzing";

  const hasSamples = Boolean(research?.samples.length);
  const detailSamples = research?.samples ?? [];

  const dominantAssetType = dominant(
    research?.samples
      .map((sample) => sample.assetType)
      .filter((value): value is string => Boolean(value)) ?? [],
  );
  const dominantStyle = dominant(
    research?.keywordAggregation
      .filter(
        (keyword) =>
          keyword.group === "visual_style_format" && keyword.supportedByInput,
      )
      .slice(0, 3)
      .map((keyword) => keyword.keyword) ?? [],
  );
  const popularVocabulary = research?.keywordAggregation
    .filter((keyword) => keyword.supportedByInput)
    .slice(0, 5)
    .map((keyword) => keyword.keyword)
    .join(", ");
  const selectedTitleSource = research?.selectedTitleSource ?? null;
  const selectedTitleValue =
    research?.selectedTitle?.trim() ||
    (selectedTitleSource === "initial"
      ? candidate?.initialTitle
      : selectedTitleSource === "population"
      ? research?.recommendationTitleFromPopulation
      : undefined) ||
    "";

  const copyButtonLabel = () => {
    if (copied) return "Tersalin ke clipboard";
    if (selectedStep === 1) return "Salin prompt kandidat awal";
    if (selectedStep === 2) return "Salin data pencarian sample";
    return "Salin prompt analisis population";
  };

  return (
    <section className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Research</p>
          <h3 className="mt-1 flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
            <Sparkles size={14} className="text-accent-600" /> Adobe Stock
            Population
          </h3>
        </div>
        {candidate ? (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-extrabold text-emerald-700">
            Kandidat tersimpan
          </span>
        ) : null}
      </div>

      {/* Interactive 3-Step Stepper Navigation */}
      <div className="mt-3 grid grid-cols-3 gap-1 text-center">
        <button
          type="button"
          onClick={() => setSelectedStep(1)}
          className={`flex items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[9px] font-extrabold transition-all ${
            selectedStep === 1
              ? "border-accent-400 bg-accent-50 text-accent-700 ring-2 ring-accent-400"
              : candidate
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70"
              : "border-line bg-surface text-ink-muted hover:bg-surface-muted"
          }`}
        >
          {candidate ? <Check size={10} className="text-emerald-600" /> : null}
          <span>1. Kandidat</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStep(2)}
          className={`flex items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[9px] font-extrabold transition-all ${
            selectedStep === 2
              ? "border-accent-400 bg-accent-50 text-accent-700 ring-2 ring-accent-400"
              : (research?.samples.length ?? 0) > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70"
              : "border-line bg-surface text-ink-muted hover:bg-surface-muted"
          }`}
        >
          {(research?.samples.length ?? 0) > 0 ? (
            <Check size={10} className="text-emerald-600" />
          ) : null}
          <span>2. Sample</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStep(3)}
          className={`flex items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[9px] font-extrabold transition-all ${
            selectedStep === 3
              ? "border-accent-400 bg-accent-50 text-accent-700 ring-2 ring-accent-400"
              : research?.status === "ready"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70"
              : "border-line bg-surface text-ink-muted hover:bg-surface-muted"
          }`}
        >
          {research?.status === "ready" ? (
            <Check size={10} className="text-emerald-600" />
          ) : null}
          <span>3. Analisis</span>
        </button>
      </div>

      {/* Global Busy State Bar */}
      {busy ? (
        <div className="mt-3 rounded-xl border border-accent-200 bg-accent-50/50 p-3 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-bold text-accent-800">
            <LoaderCircle size={14} className="animate-spin text-accent-600" />
            <span>
              {research?.status === "analyzing"
                ? "Gemini sedang menganalisis metadata population..."
                : research?.status === "searching"
                ? "Mengambil 20 sample dari Adobe Stock..."
                : "Menganalisis gambar kandidat awal..."}
            </span>
          </div>
          <button
            className="app-button mt-2.5 h-8 w-full text-[10px]"
            onClick={onCancel}
          >
            <X size={13} /> Batalkan proses
          </button>
        </div>
      ) : null}

      {/* STEP 1 VIEW: Initial Candidate */}
      {selectedStep === 1 ? (
        <div className="mt-3 space-y-3">
          {!candidate ? (
            <div className="rounded-xl border border-dashed border-accent-200 bg-accent-50/40 p-3.5">
              <p className="text-[10px] leading-4 text-ink-muted">
                Gemini akan menganalisis gambar asli untuk membuat search query 2-3 kata, kata kunci visual, dan kandidat judul.
              </p>
              <button
                className="app-button app-button-primary mt-3 h-8 w-full text-[10px] font-bold"
                disabled={!canUseGemini || busy}
                onClick={onAnalyzeInitial}
              >
                <Sparkles size={13} /> Buat kandidat awal
              </button>
              {!canUseGemini ? (
                <p className="mt-2 text-[9px] text-amber-700">
                  Atur dan verifikasi API key Gemini terlebih dahulu.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-line bg-surface p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                    Initial Title
                  </span>
                  <span className="rounded bg-accent-50 px-1.5 py-0.5 text-[8px] font-bold text-accent-700">
                    Confidence {Math.round((candidate.confidence ?? 1) * 100)}%
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-ink">
                  {candidate.initialTitle}
                </p>

                <div className="mt-2.5">
                  <p className="text-[9px] font-bold text-ink-muted uppercase">Visual Facts:</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {candidate.visualFacts.map((fact) => (
                      <span key={fact} className="tag-chip text-[9px]">
                        {fact}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-line-subtle pt-2 text-[9px]">
                  <div>
                    <span className="text-ink-muted">Query:</span>{" "}
                    <b className="text-ink">{candidate.searchQuery}</b>
                  </div>
                  <div>
                    <span className="text-ink-muted">Tipe:</span>{" "}
                    <b className="text-ink">{candidate.assetType ?? "vector"}</b>
                  </div>
                  <div>
                    <span className="text-ink-muted">Kategori:</span>{" "}
                    <b className="text-ink">{candidate.category ?? "—"}</b>
                  </div>
                  <div>
                    <span className="text-ink-muted">Style:</span>{" "}
                    <b className="text-ink">{candidate.visualStyle ?? "—"}</b>
                  </div>
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="app-button flex-1 h-8 text-[10px] font-bold"
                  disabled={!canUseGemini || busy}
                  onClick={onAnalyzeInitial}
                >
                  <RotateCcw size={12} /> Ulangi Analisis
                </button>
                <button
                  type="button"
                  className="app-button app-button-primary flex-1 h-8 text-[10px] font-bold"
                  onClick={() => setSelectedStep(2)}
                >
                  Lanjut ke Step 2 <ArrowRight size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* STEP 2 VIEW: Adobe Stock Search */}
      {selectedStep === 2 ? (
        <div className="mt-3 space-y-3">
          {/* Staged Search Config Inputs */}
          <div className="rounded-xl border border-line bg-surface p-3 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
              Konfigurasi Pencarian Adobe Stock
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[10px] font-bold text-ink">
                Query
                <input
                  className="app-input mt-1 h-8 text-[10px]"
                  value={research?.query ?? candidate?.searchQuery ?? ""}
                  onChange={(event) =>
                    onConfigChange({ query: event.target.value })
                  }
                  placeholder="1-3 kata utama"
                />
              </label>
              <label className="text-[10px] font-bold text-ink">
                Locale
                <input
                  className="app-input mt-1 h-8 text-[10px]"
                  value={research?.locale ?? "id"}
                  onChange={(event) =>
                    onConfigChange({ locale: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              <label className="text-[10px] font-bold text-ink">
                Asset type
                <select
                  className="app-select mt-1 h-8 text-[10px]"
                  value={research?.assetType ?? candidate?.assetType ?? "vector"}
                  onChange={(event) =>
                    onConfigChange({
                      assetType: event.target.value as AdobePopulationAssetType,
                    })
                  }
                >
                  <option value="vector">Vector</option>
                  <option value="illustration">Illustration</option>
                  <option value="photo">Photo</option>
                  <option value="image">Image</option>
                </select>
              </label>
              <label className="text-[10px] font-bold text-ink">
                Sort
                <select
                  className="app-select mt-1 h-8 text-[10px]"
                  value={research?.sort ?? "relevance"}
                  onChange={(event) =>
                    onConfigChange({
                      sort: event.target.value as AdobePopulationSort,
                    })
                  }
                >
                  <option value="relevance">Relevance</option>
                  <option value="nb_downloads">Downloads</option>
                  <option value="creation">Creation</option>
                </select>
              </label>
              <label className="text-[10px] font-bold text-ink">
                Jumlah Sample
                <select
                  className="app-select mt-1 h-8 text-[10px] font-bold text-accent-700"
                  value={research?.sampleLimit ?? 1}
                  onChange={(event) =>
                    onConfigChange({
                      sampleLimit: Number(event.target.value),
                    })
                  }
                >
                  <option value={1}>1 sample (Uji coba)</option>
                  <option value={5}>5 sample</option>
                  <option value={10}>10 sample</option>
                  <option value={20}>20 sample</option>
                </select>
              </label>
            </div>

            <button
              className="app-button app-button-primary mt-3 h-8 w-full text-[10px] font-bold shadow-sm"
              disabled={!canSearch || busy}
              onClick={onResearch}
            >
              {busy ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <Search size={13} />
              )}{" "}
              {research?.samples.length
                ? `Cari Ulang Sample Adobe Stock (${research?.sampleLimit ?? 1} sample)`
                : `Cari ${research?.sampleLimit ?? 1} Sample Adobe Stock`}
            </button>
          </div>

          {/* Live Per-Link Crawling Progress Card */}
          {research?.status === "searching" || (searchProgress && searchProgress.current < searchProgress.total) ? (
            <div className="rounded-xl border border-accent-400 bg-accent-50/70 p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-extrabold text-ink">
                  <LoaderCircle size={14} className="animate-spin text-accent-600 shrink-0" />
                  <span>{searchProgress?.statusText || "Sedang mengambil sample Adobe Stock..."}</span>
                </div>
                <span className="rounded-full bg-accent-600 px-2 py-0.5 text-[10px] font-black text-white">
                  {searchProgress?.total
                    ? `${Math.min(100, Math.round((searchProgress.current / searchProgress.total) * 100))}%`
                    : "0%"}
                </span>
              </div>

              {searchProgress?.total ? (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-accent-200">
                  <div
                    className="h-full rounded-full bg-accent-600 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((searchProgress.current / searchProgress.total) * 100)
                      )}%`,
                    }}
                  />
                </div>
              ) : null}

              {searchProgress?.currentUrl ? (
                <div className="mt-2.5 rounded-lg border border-line-subtle bg-surface p-2 text-[10px]">
                  <div className="flex items-center justify-between text-ink-muted">
                    <span className="font-extrabold text-[9px] uppercase tracking-wider text-accent-700">
                      Link #{searchProgress.current} dari {searchProgress.total}
                    </span>
                    {searchProgress.keywordsCount > 0 ? (
                      <span className="font-bold text-emerald-600 text-[9px]">
                        ✓ {searchProgress.keywordsCount} keywords
                      </span>
                    ) : (
                      <span className="text-[9px] text-ink-muted">Mengekstrak metadata...</span>
                    )}
                  </div>
                  {searchProgress.title ? (
                    <p className="mt-0.5 font-bold text-ink truncate text-[10px]" title={searchProgress.title}>
                      {searchProgress.title}
                    </p>
                  ) : null}
                  <p
                    className="mt-0.5 truncate text-[9px] text-ink-secondary font-mono"
                    title={searchProgress.currentUrl}
                  >
                    {searchProgress.currentUrl}
                  </p>
                </div>
              ) : null}

              <p className="mt-2 text-[9px] text-ink-muted flex items-center gap-1">
                <span>⏱️</span>
                <span>Setiap URL sample dibuka di WebView untuk mengambil metadata detail Adobe secara langsung.</span>
              </p>
            </div>
          ) : null}

          {/* Sample Results List */}
          {detailSamples.length ? (
            <div className="rounded-xl border border-line bg-surface p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold text-ink">
                  Sample Terkumpul ({detailSamples.length} URL)
                </p>
                <span className="rounded bg-accent-50 px-1.5 py-0.5 text-[8px] font-bold text-accent-700">
                  Metadata detail siap
                </span>
              </div>
              <div className="mt-2 max-h-[220px] overflow-y-auto space-y-1.5">
                {detailSamples.map((sample) => (
                  <div
                    key={`${sample.sampleRank}-${sample.url}`}
                    className="rounded-lg border border-line-subtle p-2 text-[9px] hover:bg-surface-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="w-4 shrink-0 font-black text-accent-700">
                        #{sample.sampleRank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">
                          {sample.title || sample.searchTitle || "Sample Adobe Stock"}
                        </p>
                        <button
                          type="button"
                          className="mt-0.5 flex max-w-full items-center gap-1 truncate text-left text-accent-700 hover:underline"
                          onClick={() => void openUrl(sample.url)}
                          title={sample.url}
                        >
                          <span className="truncate">{sample.url}</span>
                        </button>
                        <p
                          className="mt-1 line-clamp-2 leading-4 text-ink-muted"
                          title={sample.keywords.join(", ") || "Keyword belum terbaca"}
                        >
                          <span className="font-bold text-accent-500">
                            Keywords ({sample.keywords.length}):
                          </span>{" "}
                          {sample.keywords.length
                            ? sample.keywords.join(", ")
                            : "Keyword belum terbaca"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-surface-muted/30 p-4 text-center text-[10px] text-ink-muted">
              Belum ada sample Adobe Stock. Klik <b>Cari 20 Sample Adobe Stock</b> di atas untuk mengambil data.
            </div>
          )}

          {/* Step 2 Navigation */}
          <div className="flex gap-2">
            <button
              type="button"
              className="app-button flex-1 h-8 text-[10px] font-bold"
              onClick={() => setSelectedStep(1)}
            >
              <ArrowLeft size={12} /> Kembali ke Step 1
            </button>
            <button
              type="button"
              className="app-button app-button-primary flex-1 h-8 text-[10px] font-bold"
              disabled={!research?.samples.length}
              onClick={() => setSelectedStep(3)}
            >
              Lanjut ke Step 3: Analisis <ArrowRight size={12} />
            </button>
          </div>
        </div>
      ) : null}


      {/* STEP 3 VIEW: Population Analysis & Recommendations */}
      {selectedStep === 3 ? (
        <div className="mt-3 space-y-3">
          {/* Action Card for Analysis */}
          <div className="relative overflow-hidden rounded-2xl border border-accent-400/40 bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-accent-500">
                Tahap 3: Analisis Population
              </span>
              <span className="rounded-full border border-accent-500/30 bg-accent-500/15 px-2.5 py-1 text-[9px] font-black text-ink">
                {research?.status === "ready" ? "Selesai" : "Siap Dianalisis"}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-[10px] leading-5 text-ink-secondary">
              {research?.status === "ready"
                ? "Sintesis populasi selesai. Sistem sudah memilih dan menerapkan judul terbaik secara otomatis; pilihan di bawah dapat dipakai sebagai override manual."
                : "Jalankan analisis Gemini untuk menggabungkan metadata sample dan menghasilkan rekomendasi title serta ranking keyword."}
            </p>
            <button
              className="app-button app-button-primary mt-3 h-10 w-full rounded-xl text-[10px] font-extrabold tracking-wide shadow-accent"
              disabled={!canUseGemini || !hasSamples || busy}
              onClick={onAnalyzePopulation}
            >
              <Sparkles size={13} />{" "}
              {research?.status === "ready"
                ? "Analisis Ulang Hasil Population"
                : "Analisis Hasil Population"}
            </button>
          </div>

          {/* Analysis Results when Ready */}
          {research?.status === "ready" ? (
            <>
              {/* Final Automated Title */}
              <div className="rounded-xl border border-accent-300/45 bg-surface-raised p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-accent-600">
                      <Check size={12} /> Judul final otomatis
                    </p>
                    <p className="mt-1 text-[12px] font-bold leading-5 text-ink">
                      {selectedTitleValue || "Judul belum tersedia"}
                    </p>
                  </div>
                  {research.automaticTitleSelection ? (
                    <span className="shrink-0 rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-extrabold text-accent-600">
                      {Math.round(research.automaticTitleSelection.score.total * 100)}%
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[9px] leading-4 text-ink-secondary">
                  {research.automaticTitleSelection
                    ? `Dipilih dari ${research.automaticTitleSelection.source === "population" ? "rekomendasi population" : research.automaticTitleSelection.source === "initial" ? "kandidat awal" : "judul saat ini"} berdasarkan fakta visual dan relevansi query.`
                    : "Judul aktif dari hasil research."}
                </p>

                <details className="group mt-3 rounded-lg border border-line bg-surface/70 px-2.5 py-2 text-[9px]">
                  <summary className="cursor-pointer list-none font-bold text-ink-muted marker:hidden group-open:text-accent-600">
                    Lihat detail penilaian
                  </summary>
                  <div className="mt-2 border-t border-line-subtle pt-2">
                    {research.titleScore ? (
                      <>
                        <div className="flex items-center justify-between font-bold text-ink-muted">
                          <span>Rekomendasi AI</span>
                          <span className="text-accent-600">{Math.round(research.titleScore.total * 100)}%</span>
                        </div>
                        <p className="mt-1 leading-4 text-ink">
                          {research.recommendationTitleFromPopulation || "Tidak tersedia"}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[8px] text-ink-muted sm:grid-cols-5">
                          <span className="whitespace-nowrap">Image {Math.round(research.titleScore.imageAccuracy * 100)}%</span>
                          <span className="whitespace-nowrap">Query {Math.round(research.titleScore.queryCoverage * 100)}%</span>
                          <span className="whitespace-nowrap">Pop {Math.round((research.titleScore.populationKeywordCoverage ?? 0.5) * 100)}%</span>
                          <span className="whitespace-nowrap">Buyer {Math.round(research.titleScore.buyerIntentClarity * 100)}%</span>
                          <span className="whitespace-nowrap">Original {Math.round(research.titleScore.originality * 100)}%</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-ink-muted">Detail skor belum tersedia.</p>
                    )}
                  </div>
                </details>
              </div>

              {/* Manual Title Overrides */}
              <div className="rounded-xl border border-line bg-surface p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
                    Ganti judul manual
                  </p>
                  <span className="text-[8px] font-semibold text-ink-faint">opsional</span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    aria-pressed={selectedTitleSource === "initial"}
                    title="Terapkan judul yang dibuat pada Tahap 1"
                    className={`app-button min-h-10 px-2 text-[9px] leading-3 transition-all ${
                      selectedTitleSource === "initial"
                        ? "border-accent-500 bg-accent-500/15 text-ink ring-1 ring-accent-500/40"
                        : "bg-surface/70 hover:border-accent-300 hover:bg-accent-500/10 hover:text-ink"
                    }`}
                    onClick={() => onChooseTitle("initial")}
                  >
                    {selectedTitleSource === "initial" ? <Check size={12} /> : null}
                    <span className="text-center font-bold">Kandidat awal</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={selectedTitleSource === "population"}
                    title="Terapkan judul rekomendasi dari analisis sample population"
                    className={`app-button min-h-10 px-2 text-[9px] leading-3 transition-all ${
                      selectedTitleSource === "population"
                        ? "border-accent-500 bg-accent-500/15 text-ink ring-1 ring-accent-500/40"
                        : "bg-surface/70 hover:border-accent-300 hover:bg-accent-500/10 hover:text-ink"
                    }`}
                    onClick={() => onChooseTitle("population")}
                  >
                    {selectedTitleSource === "population" ? <Check size={12} /> : null}
                    <span className="text-center font-bold">Population</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={selectedTitleSource === "custom"}
                    title="Pertahankan judul yang sedang digunakan aset"
                    className={`app-button min-h-10 px-2 text-[9px] leading-3 transition-all ${
                      selectedTitleSource === "custom"
                        ? "border-accent-500 bg-accent-500/15 text-ink ring-1 ring-accent-500/40"
                        : "bg-surface/70 hover:border-accent-300 hover:bg-accent-500/10 hover:text-ink"
                    }`}
                    onClick={() => onChooseTitle("custom")}
                  >
                    {selectedTitleSource === "custom" ? <Check size={12} /> : null}
                    <span className="text-center font-bold">Judul saat ini</span>
                  </button>
                </div>
              </div>

              {/* Population Summary Card */}
              <div className="rounded-xl border border-line bg-surface p-3 text-[10px] shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="font-extrabold text-ink">Research Pro signal</p>
                  <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                    research.confidenceLabel === "high"
                      ? "bg-emerald-100 text-emerald-700"
                      : research.confidenceLabel === "medium"
                      ? "bg-sky-100 text-sky-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {research.confidenceLabel ?? "pending"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[9px]">
                  <div className="rounded-lg bg-surface-sunken/60 px-2 py-1.5">
                    <span className="block text-ink-muted">Confidence</span>
                    <b className="text-ink">{research.confidenceScore !== undefined ? `${Math.round(research.confidenceScore * 100)}%` : "—"}</b>
                  </div>
                  <div className="rounded-lg bg-surface-sunken/60 px-2 py-1.5">
                    <span className="block text-ink-muted">Extraction</span>
                    <b className="text-ink">{research.extractionCoverage !== undefined ? `${Math.round(research.extractionCoverage * 100)}%` : `${detailSamples.filter((sample) => sample.metadataStatus === "extracted").length}/${detailSamples.length || 0}`}</b>
                  </div>
                  <div className="rounded-lg bg-surface-sunken/60 px-2 py-1.5">
                    <span className="block text-ink-muted">Cohort</span>
                    <b className="text-ink">{research.availableCohorts?.length ?? 0} tersedia</b>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(research.availableCohorts ?? ["relevance"]).map((cohort) => (
                    <span key={cohort} className="rounded bg-accent-50 px-1.5 py-0.5 text-[8px] font-bold text-accent-700">
                      {cohort.replace("_", " ")}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[9px] leading-4 text-ink-muted">
                  Skor ini adalah estimasi internal berbasis metadata publik, bukan formula ranking resmi Adobe Stock.
                </p>
                <p className="font-extrabold text-ink">Population summary</p>
                <p className="mt-1 text-ink-muted">
                  Vocabulary sering:{" "}
                  <b className="text-ink">{popularVocabulary || "tidak tersedia"}</b>
                </p>
                <p className="mt-1 text-ink-muted">
                  Asset type dominan:{" "}
                  <b className="text-ink">{dominantAssetType || "tidak tersedia"}</b>
                </p>
                <p className="mt-1 text-ink-muted">
                  Style dominan:{" "}
                  <b className="text-ink">{dominantStyle || "tidak tersedia"}</b>
                </p>
                {research.recommendedFocusKeywords?.length ? (
                  <p className="mt-1 text-ink-muted">
                    Focus keyword Gemini:{" "}
                    <b className="text-ink">
                      {research.recommendedFocusKeywords.join(", ")}
                    </b>
                  </p>
                ) : null}
                {unsupported(research).length ? (
                  <p className="mt-1 text-amber-700">
                    Unsupported: {unsupported(research).join(", ")}
                  </p>
                ) : null}
              </div>

              {/* Keyword Aggregation Table */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-extrabold text-ink">
                    Keyword aggregation ({research.selectedKeywords.length} terpilih)
                  </p>
                  <button
                    className="app-button h-7 px-2 text-[9px] font-bold"
                    disabled={!research.selectedKeywords.length}
                    onClick={onApplyKeywords}
                  >
                    Pakai pilihan ({research.selectedKeywords.length})
                  </button>
                </div>
                <div className="mt-1.5 overflow-hidden rounded-xl border border-line bg-surface">
                  {research.keywordAggregation
                    .slice(0, 35)
                    .map((keyword, index) => (
                      <label
                        key={keyword.normalizedKeyword}
                        className={`flex items-center gap-2 border-b border-line-subtle px-2.5 py-2 text-[9px] last:border-0 ${
                          index < 10 ? "bg-accent-50/50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3 accent-accent-600"
                          checked={research.selectedKeywords.includes(
                            keyword.normalizedKeyword,
                          )}
                          onChange={() =>
                            onToggleKeyword(keyword.normalizedKeyword)
                          }
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                          {keyword.keyword}
                        </span>
                        <span className="shrink-0 text-ink-muted">
                          {keyword.group}
                        </span>
                        <span className="w-16 shrink-0 text-right text-ink-muted">
                          {keyword.frequency}× · p{keyword.averageKeywordPosition}
                        </span>
                        <span className="w-12 shrink-0 text-right font-bold text-accent-700" title={`Relevance ${Math.round((keyword.relevanceScore ?? 0) * 100)}% · Image ${Math.round((keyword.imageSemanticFit ?? keyword.semanticMatch) * 100)}%`}>
                          {Math.round((keyword.finalScore ?? keyword.populationScore / 100) * 100)}%
                        </span>
                      </label>
                    ))}
                </div>
                <p className="mt-1 text-[9px] text-ink-muted">
                  10 keyword teratas diberi highlight prioritas. Semua keyword hasil analisis dapat dipilih; tetap pastikan relevansinya dengan aset.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-surface-sunken/60 px-5 py-6 text-center text-[10px] leading-5 text-ink-muted">
              Hasil analisis belum digenerate. Klik tombol{" "}
              <span className="font-extrabold text-accent-500">Analisis Hasil Population</span>{" "}
              di atas.
            </div>
          )}

          {/* Step 3 Navigation */}
          <div>
            <button
              type="button"
              className="app-button w-full h-8 text-[10px] font-bold"
              onClick={() => setSelectedStep(2)}
            >
              <ArrowLeft size={12} /> Kembali ke Step 2: Sample
            </button>
          </div>
        </div>
      ) : null}

      {/* Copy Prompt / AI Response Helpers */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="app-button h-7 min-w-0 flex-1 text-[9px]"
          onClick={() => {
            if (!candidate) return;
            const text = buildPopulationChatPackage(
              candidate,
              research,
              selectedStep,
            );
            void navigator.clipboard
              .writeText(text)
              .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              })
              .catch(() => setCopied(false));
          }}
        >
          <Clipboard size={12} /> {copyButtonLabel()}
        </button>
        {selectedStep === 3 ? (
          <button
            type="button"
            className="app-button h-7 min-w-0 flex-1 text-[9px]"
            disabled={!research || research.status !== "ready"}
            onClick={() => {
              if (!research || research.status !== "ready") return;
              void navigator.clipboard
                .writeText(buildPopulationAiResponsePackage(research))
                .then(() => {
                  setAiResponseCopied(true);
                  window.setTimeout(() => setAiResponseCopied(false), 1800);
                })
                .catch(() => setAiResponseCopied(false));
            }}
          >
            <Sparkles size={12} /> {aiResponseCopied ? "Respons AI tersalin" : "Salin respons AI"}
          </button>
        ) : null}
      </div>

      {/* Status info bar */}
      <div className="mt-2 flex items-center justify-between text-[9px] font-semibold text-ink-muted">
        <span>
          Status: <b className="text-ink">{statusLabel(research?.status ?? "idle")}</b>
          {research?.stale ? " · hasil stale" : ""}
        </span>
        <span>Melihat: <b>Step {selectedStep}/3</b></span>
      </div>

      {research?.warnings.length ? (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[9px] text-amber-800">
          {research.warnings.map((warning) => (
            <p key={warning.code}>{warning.message}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function statusLabel(status: AdobePopulationResearch["status"]): string {
  return {
    idle: "Siap",
    initializing: "Menganalisis gambar",
    searching: "Mengambil sample",
    review: "Review hasil pencarian",
    extracted: "Metadata sample siap",
    analyzing: "Menganalisis metadata population",
    ready: "Selesai",
    failed: "Gagal",
  }[status];
}

function dominant(values: string[]): string {
  if (!values.length) return "";
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
}

function unsupported(research: AdobePopulationResearch): string[] {
  return research.keywordAggregation
    .filter((keyword) => !keyword.supportedByInput)
    .slice(0, 5)
    .map((keyword) => keyword.keyword);
}

function buildPopulationChatPackage(
  candidate: InitialCandidate,
  research?: AdobePopulationResearch,
  selectedStep: number = 3,
): string {
  const assetType = research?.assetType ?? candidate.assetType ?? "vector";
  const sort = research?.sort ?? "relevance";
  const locale = research?.locale ?? "id";
  const samples = research?.samples ?? [];

  if (selectedStep === 1) {
    return [
      "METALIZER — POPULATION RESEARCH (TAHAP 1: KANDIDAT AWAL)",
      "",
      "INSTRUKSI: Upload gambar asli di Gemini Chat dengan prompt di bawah.",
      "",
      "=== SYSTEM INSTRUCTION ===",
      "You are analyzing one uploaded Adobe Stock asset. Return structured JSON only. Create a search_query in English with exactly 2 or 3 main words, search_terms matching it, and an initial_title using [primary subject/event] + [asset type/function] + [visual style/format]. Use only visible facts. Never use the filename, a year, unsupported objects, or copied Adobe Stock titles. visual_facts must be concise visible evidence.",
      "",
      "=== USER PROMPT ===",
      "Analyze this stock asset image and return initial candidate metadata in JSON format.",
      "",
      "=== EXPECTED JSON OUTPUT SHAPE ===",
      JSON.stringify(
        {
          asset_id: candidate.assetId,
          search_query: candidate.searchQuery,
          search_terms: candidate.searchTerms,
          initial_title: candidate.initialTitle,
          visual_facts: candidate.visualFacts,
          asset_type: candidate.assetType,
          visual_style: candidate.visualStyle,
          category: candidate.category,
          confidence: candidate.confidence,
        },
        null,
        2,
      ),
    ].join("\n");
  }

  if (selectedStep === 2) {
    return [
      "METALIZER — POPULATION RESEARCH (TAHAP 2: SAMPLE PENCARIAN & METADATA ASLI)",
      "",
      `SEARCH QUERY: ${candidate.searchQuery}`,
      `ASSET TYPE: ${assetType}`,
      `SORT: ${sort}`,
      `LOCALE: ${locale}`,
      `TOTAL SAMPLES: ${samples.length}`,
      "",
      "DAFTAR SAMPLE & METADATA TERKUMPUL (JSON):",
      JSON.stringify(
        samples.map((s) => ({
          sampleRank: s.sampleRank,
          url: s.url,
          assetId: s.assetId ?? null,
          title: s.title ?? s.searchTitle ?? null,
          keywords: s.keywords,
          category: s.category ?? null,
          contributor: s.contributor ?? null,
          assetType: s.assetType ?? null,
          creationDate: s.creationDate ?? null,
          metadataStatus: s.metadataStatus,
        })),
        null,
        2,
      ),
    ].join("\n");
  }

  if (selectedStep === 3) {
    const extractedData = JSON.stringify(
      samples.map((s) => ({
        sample_rank: s.sampleRank,
        url: s.url,
        asset_id: s.assetId ?? null,
        title: s.title ?? null,
        keywords: s.keywords,
        category: s.category ?? null,
        contributor: s.contributor ?? null,
        asset_type: s.assetType ?? null,
        creation_date: s.creationDate ?? null,
        metadata_status: s.metadataStatus,
        extraction_error: s.extractionError ?? null,
      })),
      null,
      2,
    );

    const prompt = [
      "Analyze the Stage 2 population metadata and recommend a compliant, market-aligned title and focus keywords for the original image.",
      "",
      `ORIGINAL ASSET CANDIDATE TITLE: ${candidate.initialTitle}`,
      `ORIGINAL ASSET VISUAL FACTS: ${candidate.visualFacts.join(", ")}`,
      `SEARCH QUERY: ${candidate.searchQuery}`,
      `ASSET TYPE: ${assetType}`,
      "",
      "STAGE 2 POPULATION METADATA (JSON):",
      extractedData,
      "",
      "RULES:",
      "- recommendation_title_from_population: Return 1 compelling, clear title describing the original asset accurately.",
      "- recommended_focus_keywords: array of up to 20 focus keywords directly supported by the original asset.",
    ].join("\n");

    return [
      "METALIZER — POPULATION RESEARCH (TAHAP 3: ANALISIS POPULATION)",
      "",
      "INSTRUKSI: Upload gambar asli secara manual di Gemini Chat.",
      "",
      "=== SYSTEM INSTRUCTION ===",
      "You are a conservative Adobe Stock population analyst. The request contains the original uploaded image and metadata collected in Stage 2 from Adobe WebView. Analyze only records marked extracted and use them as population evidence, never as facts about the original image. The recommendation must describe the original image. A focus keyword is allowed only when supported by the original image or its visual facts. Never copy a sample title in full and never invent metadata for unavailable records. Return structured JSON only.",
      "",
      "=== USER PROMPT ===",
      prompt,
      "",
      "=== EXPECTED JSON OUTPUT SHAPE ===",
      JSON.stringify(
        {
          recommendation_title_from_population: "string",
          recommended_focus_keywords: ["keyword1", "keyword2"],
        },
        null,
        2,
      ),
    ].join("\n");
  }

  return "";
}

function buildPopulationAiResponsePackage(research: AdobePopulationResearch): string {
  return JSON.stringify(
    {
      recommendation_title_from_population:
        research.recommendationTitleFromPopulation ?? "",
      recommended_focus_keywords: research.recommendedFocusKeywords ?? [],
    },
    null,
    2,
  );
}
