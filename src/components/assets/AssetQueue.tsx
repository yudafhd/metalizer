import { AlertTriangle, Check, Circle, FileImage, LoaderCircle, MoreHorizontal, Trash2, X } from "lucide-react";

import type { AssetStatus, StockAsset } from "../../types";

interface AssetQueueProps {
  assets: StockAsset[];
  selectedAssetId?: string;
  selectedAssetIds: string[];
  isGenerating: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
  onRetryFailed: () => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onChoose: () => void;
}

export function AssetQueue({ assets, selectedAssetId, selectedAssetIds, isGenerating, onSelect, onToggle, onRemove, onClearCompleted, onClearAll, onRetryFailed, onDrop, onChoose }: AssetQueueProps) {
  const failed = assets.filter((asset) => asset.status === "failed").length;
  return (
    <aside className="flex w-[292px] shrink-0 flex-col border-r border-line bg-[#fbfcfc]">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p className="eyebrow">Asset queue</p>
          <p className="mt-1 text-[13px] font-bold text-ink">{assets.length} images</p>
        </div>
        <button className="app-button app-button-quiet h-8 w-8 px-0" aria-label="Asset menu" title="Asset actions"><MoreHorizontal size={17} /></button>
      </div>
      {assets.length === 0 ? (
        <div className="m-4 rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slatepanel text-slate-400"><FileImage size={20} /></div>
          <p className="mt-3 text-[12px] font-semibold text-ink">Drop images here</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">JPG, PNG, or WebP · up to 6 per AI batch</p>
          <button className="app-button mt-4 h-8 w-full text-[11px]" onClick={onChoose}>Choose images</button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
          {assets.map((asset) => (
            <AssetRow key={asset.id} asset={asset} selected={asset.id === selectedAssetId} checked={selectedAssetIds.includes(asset.id)} onSelect={onSelect} onToggle={onToggle} onRemove={onRemove} />
          ))}
          <div className="mt-3 rounded-md border border-dashed border-line px-3 py-3 text-center" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <p className="text-[11px] text-slate-400">Drop more images to add</p>
          </div>
        </div>
      )}
      <div className="border-t border-line p-3">
        <div className="grid grid-cols-3 gap-1.5">
          <button className="app-button h-8 px-1 text-[10px]" disabled={!assets.some((asset) => asset.status === "completed")} onClick={onClearCompleted}>Clear done</button>
          <button className="app-button h-8 px-1 text-[10px]" disabled={!assets.length || isGenerating} onClick={onClearAll}>Clear all</button>
          <button className="app-button h-8 px-1 text-[10px]" disabled={!failed || isGenerating} onClick={onRetryFailed}>Retry failed</button>
        </div>
      </div>
    </aside>
  );
}

function AssetRow({ asset, selected, checked, onSelect, onToggle, onRemove }: { asset: StockAsset; selected: boolean; checked: boolean; onSelect: (id: string) => void; onToggle: (id: string) => void; onRemove: (id: string) => void }) {
  return (
    <div className={`group mb-1 flex items-center gap-2 rounded-md border px-2 py-2 transition ${selected ? "border-accent/40 bg-accent/[0.05]" : "border-transparent hover:border-line hover:bg-white"}`}>
      <input aria-label={`Select ${asset.filename}`} type="checkbox" checked={checked} onChange={() => onToggle(asset.id)} className="accent-accent" />
      <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(asset.id)}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-slatepanel">
          {asset.previewUrl ? <img src={asset.previewUrl} alt="" className="h-full w-full object-contain" /> : <FileImage size={15} className="text-slate-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-ink" title={asset.filename}>{asset.filename}</p>
          <div className="mt-1 flex items-center gap-1.5"><StatusIcon status={asset.status} /><span className="text-[10px] capitalize text-slate-400">{statusLabel(asset.status)}</span></div>
        </div>
      </button>
      {asset.error ? <span title={asset.error}><AlertTriangle size={13} className="shrink-0 text-amber-500" /></span> : null}
      <button className="invisible rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover:visible" onClick={() => onRemove(asset.id)} aria-label={`Remove ${asset.filename}`}><X size={14} /></button>
    </div>
  );
}

function StatusIcon({ status }: { status: AssetStatus }) {
  if (status === "completed") return <Check size={12} className="text-mint" strokeWidth={3} />;
  if (status === "failed") return <AlertTriangle size={12} className="text-amber-500" />;
  if (status === "preparing" || status === "processing") return <LoaderCircle size={12} className="animate-spin text-accent" />;
  if (status === "queued") return <Circle size={9} className="text-slate-400" />;
  return <Trash2 size={11} className="text-slate-300" />;
}

function statusLabel(status: AssetStatus): string {
  return status === "completed" ? "Complete" : status === "processing" ? "Processing" : status === "preparing" ? "Preparing" : status === "failed" ? "Failed" : "Queued";
}
