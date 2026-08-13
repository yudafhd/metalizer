import { AlertCircle, CheckCircle2, ChevronRight, FileImage, Minus, RotateCcw, Square, Tag, X } from "lucide-react";
import { useState } from "react";

import { ADOBE_CATEGORIES, categoryName } from "../../constants/categories";
import type { StockAsset } from "../../types";
import { metadataLabel } from "../../utils/metadata";

interface MetadataTableProps {
  assets: StockAsset[];
  selectedAssetId?: string;
  selectedAssetIds: string[];
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSetCategory: (category: number) => void;
  onAddKeyword: (keyword: string) => void;
  onRemoveKeyword: (keyword: string) => void;
  onRegenerate: () => void;
}

export function MetadataTable({ assets, selectedAssetId, selectedAssetIds, onSelect, onToggle, onSelectAll, onSetCategory, onAddKeyword, onRemoveKeyword, onRegenerate }: MetadataTableProps) {
  const allSelected = assets.length > 0 && selectedAssetIds.length === assets.length;
  const [category, setCategory] = useState(8);
  const [keyword, setKeyword] = useState("");
  const [removeKeyword, setRemoveKeyword] = useState("");
  const submitAdd = () => { if (keyword.trim()) { onAddKeyword(keyword.trim()); setKeyword(""); } };
  const submitRemove = () => { if (removeKeyword.trim()) { onRemoveKeyword(removeKeyword.trim()); setRemoveKeyword(""); } };
  return (
    <section className="min-w-0 flex-1 overflow-hidden bg-white">
      <div className="flex h-[58px] items-center justify-between border-b border-line px-6">
        <div><p className="eyebrow">Metadata workspace</p><p className="mt-1 text-[13px] font-bold text-ink">Review and edit results</p></div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400"><span><b className="text-ink">{assets.filter((asset) => asset.metadata).length}</b> metadata ready</span><span className="h-3 w-px bg-line" /><span>Click a row to inspect</span></div>
      </div>
      {selectedAssetIds.length ? <div className="flex flex-wrap items-center gap-2 border-b border-line bg-[#fffdfb] px-6 py-2.5"><span className="mr-1 text-[10px] font-bold text-accent">{selectedAssetIds.length} selected</span><div className="flex items-center gap-1"><Tag size={12} className="text-slate-400" /><select className="app-select h-7 w-[190px] text-[10px]" value={category} onChange={(event) => setCategory(Number(event.target.value))}><option value={8}>Set category…</option>{ADOBE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.id} — {item.name}</option>)}</select><button className="app-button h-7 px-2 text-[10px]" onClick={() => onSetCategory(category)}>Apply</button></div><div className="flex items-center gap-1"><input className="app-input h-7 w-[130px] text-[10px]" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitAdd(); }} placeholder="Add keyword" /><button className="app-button h-7 px-2 text-[10px]" onClick={submitAdd}>Add</button></div><div className="flex items-center gap-1"><input className="app-input h-7 w-[130px] text-[10px]" value={removeKeyword} onChange={(event) => setRemoveKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitRemove(); }} placeholder="Remove keyword" /><button className="app-button h-7 px-2 text-[10px]" onClick={submitRemove}><X size={11} /> Remove</button></div><button className="app-button h-7 px-2 text-[10px]" onClick={onRegenerate}><RotateCcw size={11} /> Regenerate</button></div> : null}
      {assets.length === 0 ? <TableEmpty /> : <div className={`overflow-auto ${selectedAssetIds.length ? "h-[calc(100%-104px)]" : "h-[calc(100%-58px)]"}`}><table className="w-full min-w-[740px] border-collapse text-left"><thead className="sticky top-0 z-10 bg-[#fbfcfc] text-[10px] font-bold uppercase tracking-wider text-slate-400"><tr className="border-b border-line"><th className="w-11 px-5 py-3"><button aria-label="Select all assets" onClick={onSelectAll} className="flex items-center justify-center text-slate-400">{allSelected ? <CheckCircle2 size={15} className="text-accent" /> : selectedAssetIds.length ? <Minus size={15} className="text-accent" /> : <Square size={14} />}</button></th><th className="w-20 px-2 py-3">Preview</th><th className="px-2 py-3">Filename</th><th className="min-w-[250px] px-2 py-3">Title</th><th className="w-28 px-2 py-3">Keywords</th><th className="w-32 px-2 py-3">Category</th><th className="w-24 px-2 py-3">Score</th><th className="w-10 px-2 py-3" /></tr></thead><tbody>{assets.map((asset) => <MetadataRow key={asset.id} asset={asset} selected={asset.id === selectedAssetId} checked={selectedAssetIds.includes(asset.id)} onSelect={onSelect} onToggle={onToggle} />)}</tbody></table></div>}
    </section>
  );
}

function MetadataRow({ asset, selected, checked, onSelect, onToggle }: { asset: StockAsset; selected: boolean; checked: boolean; onSelect: (id: string) => void; onToggle: (id: string) => void }) {
  const metadata = asset.metadata;
  return <tr className={`group cursor-pointer border-b border-line/70 transition hover:bg-[#fbfcfc] ${selected ? "bg-accent/[0.04]" : ""}`} onClick={() => onSelect(asset.id)}>
    <td className="px-5 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${asset.filename}`} checked={checked} onChange={() => onToggle(asset.id)} className="accent-accent" /></td>
    <td className="px-2 py-3"><div className="flex h-11 w-14 items-center justify-center overflow-hidden rounded border border-line bg-slatepanel">{asset.previewUrl ? <img src={asset.previewUrl} alt="" className="h-full w-full object-contain" /> : <FileImage size={15} className="text-slate-400" />}</div></td>
    <td className="max-w-[170px] px-2 py-3"><p className="truncate text-[12px] font-semibold text-ink" title={asset.filename}>{asset.filename}</p><p className="mt-1 text-[10px] text-slate-400">{asset.width} × {asset.height}</p></td>
    <td className="max-w-[290px] px-2 py-3"><p className={`truncate text-[12px] ${metadata?.title ? "font-medium text-ink" : "italic text-slate-400"}`}>{metadata?.title || (asset.status === "processing" ? "Generating…" : "No metadata yet")}</p>{metadata?.warnings.length ? <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600"><AlertCircle size={11} />{metadata.warnings.length} review {metadata.warnings.length === 1 ? "item" : "items"}</p> : null}</td>
    <td className="px-2 py-3"><span className="rounded-full bg-slatepanel px-2 py-1 text-[10px] font-semibold text-slate-500">{metadata ? `${metadata.keywords.length} words` : "—"}</span></td>
    <td className="px-2 py-3 text-[11px] text-slate-500">{metadata ? <><span className="block truncate">{categoryName(metadata.category)}</span><span className="mt-1 block text-[10px] text-slate-400">Category {metadata.category}</span></> : "—"}</td>
    <td className="px-2 py-3">{metadata ? <div><span className={`text-[14px] font-bold ${metadata.qualityScore >= 90 ? "text-mint" : metadata.qualityScore >= 70 ? "text-amber-600" : "text-red-500"}`}>{metadata.qualityScore}</span><span className="mt-0.5 block text-[9px] text-slate-400">{metadataLabel(metadata.qualityScore)}</span></div> : "—"}</td>
    <td className="px-2 py-3"><ChevronRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-accent" /></td>
  </tr>;
}

function TableEmpty() {
  return <div className="flex h-[calc(100%-58px)] items-center justify-center"><div className="max-w-[360px] text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slatepanel text-slate-400"><FileImage size={22} /></div><h2 className="mt-4 text-[15px] font-bold text-ink">Your metadata workspace is empty</h2><p className="mt-2 text-[12px] leading-5 text-slate-400">Add a group of stock images to create a numbered contact sheet and generate reviewable Adobe Stock metadata.</p></div></div>;
}
