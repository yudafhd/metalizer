import { ChevronDown, Download, FolderOpen, Images, Play, Settings2, Square } from "lucide-react";

import type { AppSettings, MetadataMode } from "../../types";

interface TopBarProps {
  settings: AppSettings;
  assetCount: number;
  canGenerate: boolean;
  isGenerating: boolean;
  onAddImages: () => void;
  onAddFolder: () => void;
  onGenerate: () => void;
  onCancel: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onModeChange: (mode: MetadataMode) => void;
}

export function TopBar({ settings, assetCount, canGenerate, isGenerating, onAddImages, onAddFolder, onGenerate, onCancel, onExport, onOpenSettings, onModeChange }: TopBarProps) {
  return (
    <header className="flex h-[74px] shrink-0 items-center justify-between border-b border-line bg-white px-7">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-[14px] font-black tracking-tight text-white">AS</div>
        <div>
          <h1 className="text-[15px] font-bold leading-tight text-ink">Adobe Stock Metadata Generator</h1>
          <p className="mt-0.5 text-[11px] text-slate-400">Local batch workspace · Gemini vision</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="app-button" onClick={onAddImages} title="Choose image files">
          <Images size={14} /> Add images
        </button>
        <button className="app-button" onClick={onAddFolder} title="Choose a folder of images">
          <FolderOpen size={14} /> Add folder
        </button>
        <div className="mx-1 h-6 w-px bg-line" />
        <label className="relative">
          <span className="sr-only">Metadata mode</span>
          <select className="app-input h-9 w-[136px] cursor-pointer appearance-none pr-8 text-[12px] font-semibold" value={settings.metadataMode} onChange={(event) => onModeChange(event.target.value as MetadataMode)}>
            <option value="strict">Strict mode</option>
            <option value="balanced">Balanced mode</option>
            <option value="discovery">Discovery mode</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-3 text-slate-400" size={13} />
        </label>
        {isGenerating ? (
          <button className="app-button border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={onCancel}>
            <Square size={12} fill="currentColor" /> Cancel
          </button>
        ) : (
          <button className="app-button app-button-primary" disabled={!canGenerate} onClick={onGenerate} title={!assetCount ? "Add images first" : "Generate metadata"}>
            <Play size={13} fill="currentColor" /> Generate
          </button>
        )}
        <button className="app-button" disabled={!assetCount} onClick={onExport}>
          <Download size={14} /> Export CSV
        </button>
        <button className="app-button app-button-quiet px-2" onClick={onOpenSettings} aria-label="Open Settings" title="Settings">
          <Settings2 size={17} />
        </button>
      </div>
    </header>
  );
}
