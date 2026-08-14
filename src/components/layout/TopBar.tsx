import { BookOpen, Check, ChevronDown, Download, Settings2, Sparkles, Square } from "lucide-react";
import { useState } from "react";
import type { MetadataMode } from "../../types";

interface TopBarProps {
  assetCount: number;
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  metadataMode: MetadataMode;
  onModeChange: (mode: MetadataMode) => void;
  onExport: () => void;
  canExport: boolean;
}

export function TopBar({
  assetCount,
  canGenerate,
  isGenerating,
  onGenerate,
  onCancel,
  onOpenSettings,
  onOpenGuide,
  metadataMode,
  onModeChange,
  onExport,
  canExport,
}: TopBarProps) {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeOptions: Array<{ value: MetadataMode; label: string; detail: string }> = [
    { value: "strict", label: "Mode ketat", detail: "Hanya memakai hal yang terlihat jelas." },
    { value: "balanced", label: "Mode seimbang", detail: "Seimbang antara yang terlihat dan ide terkait." },
    { value: "discovery", label: "Mode eksplorasi", detail: "Lebih luas untuk mencari peluang keyword." },
  ];
  const selectedMode = modeOptions.find((option) => option.value === metadataMode) ?? modeOptions[1];

  return (
    <header className="flex h-[86px] shrink-0 items-center justify-between border-b border-raspberry-100 bg-surface px-6 shadow-[0_8px_24px_-20px_rgba(194,24,91,0.55)]">
      <div className="flex min-w-0 items-center gap-3.5">
        <img src="/metalizer-icon.png" alt="Metalizer" className="h-11 w-11 shrink-0 rounded-2xl object-cover shadow-raspberry" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[16px] font-extrabold leading-tight text-slate-900">Metalizer</h1>
            <span className="rounded-md border border-raspberry-200 bg-raspberry-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-raspberry-700">v0.1.0</span>
          </div>
          <p className="mt-1 text-[11px] font-bold tracking-[0.02em] text-raspberry-700">Microstock Metadata</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex items-center">
          <span className="sr-only">Mode metadata</span>
          <button type="button" className="app-select flex h-9 w-[210px] items-center justify-between gap-2 px-3 text-left text-[12px] font-bold text-slate-800" onClick={() => setModeMenuOpen((open) => !open)} aria-expanded={modeMenuOpen} aria-haspopup="listbox">
            <span className="truncate">{selectedMode.label}</span>
            <ChevronDown className={`shrink-0 text-raspberry-500 transition ${modeMenuOpen ? "rotate-180" : ""}`} size={14} />
          </button>
          {modeMenuOpen ? <div className="absolute right-0 top-11 z-30 w-[290px] overflow-hidden rounded-xl border border-raspberry-100 bg-surface shadow-xl" role="listbox" aria-label="Pilihan mode metadata">
            {modeOptions.map((option) => <button key={option.value} type="button" role="option" aria-selected={metadataMode === option.value} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-raspberry-50 ${metadataMode === option.value ? "bg-raspberry-50/70" : ""}`} onClick={() => { onModeChange(option.value); setModeMenuOpen(false); }}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${metadataMode === option.value ? "bg-raspberry-600 text-white" : "bg-slate-100 text-slate-400"}`}>{metadataMode === option.value ? <Check size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
              <span className="min-w-0 flex-1"><span className="block text-[11px] font-extrabold text-slate-800">{option.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{option.detail}</span></span>
            </button>)}
          </div> : null}
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
          <button className="app-button border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400 hover:bg-amber-100" onClick={onCancel}>
          <Square size={13} fill="currentColor" /> Batal
          </button>
        ) : (
          <button className="app-button app-button-primary" disabled={!canGenerate} onClick={onGenerate} title={!assetCount ? "Tambah gambar dulu" : "Generate metadata"}>
          <Sparkles size={14} fill="currentColor" /> Generate
          </button>
        )}
        <button className="app-button hidden lg:inline-flex" onClick={onOpenGuide} title="Buka panduan">
          <BookOpen size={15} /> Panduan
        </button>
        <button className="app-button app-button-quiet h-10 w-10 px-0" onClick={onOpenSettings} aria-label="Buka Settings" title="Settings">
          <Settings2 size={18} />
        </button>
      </div>
    </header>
  );
}
