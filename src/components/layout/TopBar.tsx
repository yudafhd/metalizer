import { BookOpen, Check, ChevronDown, Compass, Download, Layers, Palette, Settings2, Sparkles, Square } from "lucide-react";
import { useState } from "react";
import type { MetadataMode } from "../../types";
import { openUrl } from "../../services/tauri";

export type AppViewMode = "standard" | "staged";

interface TopBarProps {
  assetCount: number;
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onOpenThemePicker: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  metadataMode: MetadataMode;
  onModeChange: (mode: MetadataMode) => void;
  onExport: () => void;
  canExport: boolean;
  activeView: AppViewMode;
  onViewChange: (view: AppViewMode) => void;
}

export function TopBar({
  assetCount,
  canGenerate,
  isGenerating,
  onGenerate,
  onCancel,
  onOpenThemePicker,
  onOpenSettings,
  onOpenGuide,
  metadataMode,
  onModeChange,
  onExport,
  canExport,
  activeView,
  onViewChange,
}: TopBarProps) {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeOptions: Array<{ value: MetadataMode; label: string; detail: string }> = [
    { value: "strict", label: "Mode ketat", detail: "Hanya memakai hal yang terlihat jelas." },
    { value: "balanced", label: "Mode seimbang", detail: "Seimbang antara yang terlihat dan ide terkait." },
    { value: "discovery", label: "Mode eksplorasi", detail: "Lebih luas untuk mencari peluang keyword." },
  ];
  const selectedMode = modeOptions.find((option) => option.value === metadataMode) ?? modeOptions[1];

  return (
    <header className="flex h-[82px] shrink-0 items-center justify-between border-b border-line bg-surface px-6 shadow-panel">
      <div className="flex min-w-0 items-center gap-3.5">
        <img
          src="/metalizer-icon.png"
          alt="Metalizer"
          className="h-10 w-10 shrink-0 rounded-2xl object-cover shadow-accent"
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[16px] font-extrabold leading-tight text-ink">Metalizer</h1>
            <span className="rounded-md border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-accent-700">
              v0.2.0
            </span>
          </div>
          <button
            type="button"
            onClick={() => void openUrl("https://mahes.app")}
            className="mt-0.5 block text-left text-[11px] font-bold tracking-[0.02em] text-accent-600 hover:text-accent-500 hover:underline transition-colors"
          >
            tools by mahes.app
          </button>
        </div>
      </div>

      {/* TopBar Sliding View Mode Switcher */}
      <div className="flex items-center rounded-2xl bg-surface-sunken p-1 border border-line-subtle shadow-inner">
        <button
          type="button"
          onClick={() => onViewChange("standard")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-extrabold transition-all duration-200 ${
            activeView === "standard"
              ? "bg-surface text-ink shadow-sm border border-line"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          <Layers size={15} className={activeView === "standard" ? "text-accent-600" : ""} />
          <span>Metadata</span>
        </button>

        <button
          type="button"
          onClick={() => onViewChange("staged")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-extrabold transition-all duration-200 ${
            activeView === "staged"
              ? "bg-accent-600 text-white shadow-md shadow-accent-600/20"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          <Compass size={15} className={activeView === "staged" ? "text-white" : "text-accent-600"} />
          <span>Research (PRO)</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex items-center">
          <span className="sr-only">Mode metadata</span>
          <button
            type="button"
            className="app-select flex h-9 w-[210px] items-center justify-between gap-2 px-3 text-left text-[12px] font-bold text-ink"
            onClick={() => setModeMenuOpen((open) => !open)}
            aria-expanded={modeMenuOpen}
            aria-haspopup="listbox"
          >
            <span className="truncate">{selectedMode.label}</span>
            <ChevronDown className={`shrink-0 text-accent-500 transition-transform ${modeMenuOpen ? "rotate-180" : ""}`} size={14} />
          </button>
          {modeMenuOpen ? (
            <div
              className="absolute right-0 top-11 z-30 w-[290px] overflow-hidden rounded-xl border border-line bg-surface shadow-modal"
              role="listbox"
              aria-label="Pilihan mode metadata"
            >
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={metadataMode === option.value}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-accent-50 ${metadataMode === option.value ? "bg-accent-50/80" : ""
                    }`}
                  onClick={() => {
                    onModeChange(option.value);
                    setModeMenuOpen(false);
                  }}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${metadataMode === option.value ? "bg-accent-600 text-white shadow-sm" : "bg-surface-sunken text-ink-faint"
                      }`}
                  >
                    {metadataMode === option.value ? <Check size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-extrabold text-ink">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-ink-muted">{option.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          className="app-button"
          disabled={!canExport}
          onClick={onExport}
          title={!canExport ? "Belum ada gambar untuk di-export" : "Export metadata ke CSV"}
        >
          <Download size={14} /> Export CSV
        </button>

        {isGenerating ? (
          <button
            className="app-button border-amber-500/40 bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 active:scale-[0.98]"
            onClick={onCancel}
          >
            <Square size={13} fill="currentColor" /> Batal
          </button>

        ) : (
          <button
            className="app-button app-button-primary"
            disabled={!canGenerate}
            onClick={onGenerate}
            title={!assetCount ? "Tambah gambar dulu" : "Generate metadata"}
          >
            <Sparkles size={14} fill="currentColor" /> Generate
          </button>
        )}

        {/* Theme Button placed to the left of the Guide button */}
        <button
          className="app-button app-button-quiet h-9 w-9 px-0"
          onClick={onOpenThemePicker}
          title="Pilih tema & warna tampilan"
          aria-label="Pilih tema & warna tampilan"
        >
          <Palette size={17} />
        </button>

        <button
          className="app-button app-button-quiet h-9 w-9 px-0 hidden lg:inline-flex"
          onClick={onOpenGuide}
          title="Buka panduan"
          aria-label="Buka panduan"
        >
          <BookOpen size={17} />
        </button>

        <button
          className="app-button app-button-quiet h-9 w-9 px-0"
          onClick={onOpenSettings}
          aria-label="Buka Settings"
          title="Settings"
        >
          <Settings2 size={17} />
        </button>
      </div>
    </header>
  );
}
