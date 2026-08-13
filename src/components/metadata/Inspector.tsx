import { Clipboard, GripVertical, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ADOBE_CATEGORIES, categoryName } from "../../constants/categories";
import type { ContentSource, MetadataMode, StockAsset, StockMetadata } from "../../types";
import { emptyMetadata, qualityScore, validateMetadata } from "../../utils/metadata";

interface InspectorProps {
  asset?: StockAsset;
  mode: MetadataMode;
  onClose: () => void;
  onUpdate: (assetId: string, metadata: StockMetadata) => void;
  onRegenerate: (assetId: string, scope: "full" | "title" | "keywords") => void;
  onUndo: (assetId: string) => void;
}

export function Inspector({ asset, mode, onClose, onUpdate, onRegenerate, onUndo }: InspectorProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const metadata = useMemo(() => asset?.metadata ?? (asset ? emptyMetadata(asset, mode) : undefined), [asset, mode]);
  if (!asset || !metadata) return <aside className="flex w-[342px] shrink-0 flex-col border-l border-line bg-[#fbfcfc]"><div className="flex flex-1 items-center justify-center p-8 text-center"><div><p className="eyebrow">Inspector</p><p className="mt-2 text-[12px] leading-5 text-slate-400">Select an asset row to edit its title, category, and prioritized keywords.</p></div></div></aside>;

  const commit = (patch: Partial<StockMetadata>) => {
    const next = { ...metadata, ...patch };
    const validation = validateMetadata(asset.filename, next);
    onUpdate(asset.id, { ...next, keywords: validation.normalizedKeywords, warnings: validation.warnings, qualityScore: qualityScore({ ...next, keywords: validation.normalizedKeywords }, validation) });
  };
  const addKeyword = () => {
    const value = newKeyword.trim();
    if (!value) return;
    commit({ keywords: [...metadata.keywords, value] });
    setNewKeyword("");
  };
  const moveKeyword = (from: number, to: number) => {
    if (to < 0 || to >= metadata.keywords.length) return;
    const keywords = [...metadata.keywords];
    const [moved] = keywords.splice(from, 1);
    if (moved) keywords.splice(to, 0, moved);
    commit({ keywords });
  };
  const copy = (value: string) => navigator.clipboard.writeText(value).catch(() => undefined);

  return <aside className="flex w-[342px] shrink-0 flex-col border-l border-line bg-[#fbfcfc]">
    <div className="flex h-[58px] items-center justify-between border-b border-line px-5"><div><p className="eyebrow">Metadata inspector</p><p className="mt-1 max-w-[230px] truncate text-[12px] font-bold text-ink" title={asset.filename}>{asset.filename}</p></div><button className="app-button app-button-quiet h-8 w-8 px-0" onClick={onClose} aria-label="Close inspector"><X size={16} /></button></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="flex h-[156px] items-center justify-center overflow-hidden rounded-lg border border-line bg-white"><img src={asset.previewUrl} alt={asset.filename} className="max-h-full max-w-full object-contain" /></div>
      <div className="mt-4 flex items-center justify-between"><div><p className="text-[12px] font-semibold text-ink">{asset.width} × {asset.height}</p><p className="mt-0.5 text-[10px] text-slate-400">{formatBytes(asset.fileSize)} · {asset.mimeType.replace("image/", "").toUpperCase()}</p></div><ScoreBadge score={metadata.qualityScore} /></div>
      <div className="my-5 h-px bg-line" />
      <label className="block"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-ink">Title</span><div className="flex items-center gap-2"><button className="text-[10px] font-semibold text-slate-400 hover:text-accent" onClick={() => copy(metadata.title)}>Copy</button><span className={`text-[10px] ${metadata.title.length > 70 ? "text-red-500" : "text-slate-400"}`}>{metadata.title.length}/70</span></div></div><input className="app-input mt-2" value={metadata.title} onChange={(event) => commit({ title: event.target.value })} placeholder="Describe the strongest visible content" /></label>
      <div className="mt-4"><label className="text-[11px] font-bold text-ink">Category</label><select className="app-input mt-2" value={metadata.category} onChange={(event) => commit({ category: Number(event.target.value) })}>{ADOBE_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.id} — {category.name}</option>)}</select><p className="mt-1.5 text-[10px] text-slate-400">Current: {categoryName(metadata.category)}</p></div>
      <div className="mt-5"><div className="flex items-center justify-between"><div><span className="text-[11px] font-bold text-ink">Keywords</span><span className="ml-2 text-[10px] text-slate-400">{metadata.keywords.length} · first 10 prioritized</span></div><button className="app-button app-button-quiet h-7 px-2 text-[10px]" onClick={() => copy(metadata.keywords.join(", "))}><Clipboard size={12} /> Copy</button></div>
        <div className="mt-2 space-y-1.5">{metadata.keywords.map((keyword, index) => <div key={`${keyword}-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) moveKeyword(dragIndex, index); setDragIndex(null); }} className={`group flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${index < 10 ? "border-accent/20 bg-accent/[0.035]" : "border-line bg-white"}`}><GripVertical size={12} className="shrink-0 cursor-grab text-slate-300" /><span className={`w-5 shrink-0 text-right text-[10px] font-bold ${index < 10 ? "text-accent" : "text-slate-400"}`}>{String(index + 1).padStart(2, "0")}</span><input className="min-w-0 flex-1 bg-transparent text-[11px] text-ink outline-none" value={keyword} onChange={(event) => { const keywords = [...metadata.keywords]; keywords[index] = event.target.value; commit({ keywords }); }} /><button className="invisible rounded p-0.5 text-slate-300 hover:text-red-500 group-hover:visible" onClick={() => commit({ keywords: metadata.keywords.filter((_, keywordIndex) => keywordIndex !== index) })} aria-label={`Delete keyword ${keyword}`}><Trash2 size={12} /></button></div>)}</div>
        <div className="mt-2 flex gap-2"><input className="app-input h-8 text-[11px]" value={newKeyword} onChange={(event) => setNewKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addKeyword(); }} placeholder="Add keyword" /><button className="app-button h-8 w-8 px-0" onClick={addKeyword} aria-label="Add keyword"><Plus size={14} /></button></div>
      </div>
      <div className="mt-5"><label className="text-[11px] font-bold text-ink">Content source</label><select className="app-input mt-2" value={metadata.contentSource} onChange={(event) => commit({ contentSource: event.target.value as ContentSource })}><option value="standard">Standard</option><option value="generative-ai">Generative AI</option></select><p className="mt-1.5 text-[10px] leading-4 text-slate-400">This is a user project flag. It does not detect or infer AI origin.</p></div>
      <button className="app-button mt-5 h-8 w-full text-[10px]" onClick={() => copy(`${metadata.title}\n${metadata.keywords.join(", ")}\n${metadata.category}`)}><Clipboard size={12} /> Copy metadata</button>
      {metadata.warnings.length ? <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Review needed</p><ul className="mt-1.5 space-y-1">{metadata.warnings.map((warning) => <li key={warning.code} className="text-[10px] leading-4 text-amber-800">{warning.message}</li>)}</ul></div> : null}
    </div>
    <div className="border-t border-line p-4"><div className="grid grid-cols-4 gap-1.5"><button className="app-button h-8 px-1 text-[10px]" disabled={!asset.previousMetadata} onClick={() => onUndo(asset.id)}>Undo</button><button className="app-button h-8 px-1 text-[10px]" onClick={() => onRegenerate(asset.id, "title")}><RotateCcw size={11} /> Title</button><button className="app-button h-8 px-1 text-[10px]" onClick={() => onRegenerate(asset.id, "keywords")}><RotateCcw size={11} /> Keywords</button><button className="app-button h-8 px-1 text-[10px]" onClick={() => onRegenerate(asset.id, "full")}><RotateCcw size={11} /> All</button></div></div>
  </aside>;
}

function ScoreBadge({ score }: { score: number }) { return <div className="text-right"><p className={`text-[20px] font-black leading-none ${score >= 90 ? "text-mint" : score >= 70 ? "text-amber-600" : "text-slate-400"}`}>{score}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-slate-400">internal score</p></div>; }
function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
