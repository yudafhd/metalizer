import { AlertCircle, CheckCircle2, ChevronRight, FileImage, FolderOpen, ImagePlus, Images, LoaderCircle, Minus, RotateCcw, Square, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";

import { ADOBE_CATEGORIES, categoryName } from "../../constants/categories";
import type { StockAsset } from "../../types";
import { metadataLabel } from "../../utils/metadata";

interface MetadataTableProps {
  assets: StockAsset[];
  selectedAssetId?: string;
  selectedAssetIds: string[];
  isGenerating: boolean;
  isAddingAssets: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
  onRetryFailed: () => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onChoose: () => void;
  onAddFolder: () => void;
  onSelectAll: () => void;
  onSetCategory: (category: number) => void;
  onAddKeyword: (keyword: string) => void;
  onRemoveKeyword: (keyword: string) => void;
  onRegenerate: () => void;
}

export function MetadataTable({ assets, selectedAssetId, selectedAssetIds, isGenerating, isAddingAssets, onSelect, onToggle, onRemove, onClearCompleted, onClearAll, onRetryFailed, onDrop, onChoose, onAddFolder, onSelectAll, onSetCategory, onAddKeyword, onRemoveKeyword, onRegenerate }: MetadataTableProps) {
  const allSelected = assets.length > 0 && selectedAssetIds.length === assets.length;
  const [category, setCategory] = useState(8);
  const [keyword, setKeyword] = useState("");
  const [removeKeyword, setRemoveKeyword] = useState("");
  const submitAdd = () => { if (keyword.trim()) { onAddKeyword(keyword.trim()); setKeyword(""); } };
  const submitRemove = () => { if (removeKeyword.trim()) { onRemoveKeyword(removeKeyword.trim()); setRemoveKeyword(""); } };
  const readyCount = assets.filter((asset) => asset.metadata).length;
  const failedCount = assets.filter((asset) => asset.status === "failed").length;
  const tableHeight = selectedAssetIds.length ? "h-[calc(100%-144px)]" : "h-[calc(100%-76px)]";
  return (
    <section className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-raspberry-100 bg-surface shadow-panel">
      <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-raspberry-100 px-6 py-3.5">
        <div>
          <p className="eyebrow">Workspace</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
          <button className="app-button app-button-primary h-8 px-2.5 text-[10px]" disabled={isAddingAssets} onClick={onChoose} title="Pilih file gambar">
            {isAddingAssets ? <LoaderCircle size={13} className="animate-spin" /> : <Images size={13} />} {isAddingAssets ? "Memuat gambar..." : "Tambah gambar"}
          </button>
          <button className="app-button h-8 px-2.5 text-[10px]" disabled={isAddingAssets} onClick={() => void onAddFolder()} title="Pilih folder gambar">
            {isAddingAssets ? <LoaderCircle size={13} className="animate-spin" /> : <FolderOpen size={13} />} {isAddingAssets ? "Membaca folder..." : "Tambah folder"}
          </button>
          {isAddingAssets ? <span className="mr-1 flex items-center gap-1.5 rounded-full bg-raspberry-50 px-2.5 py-1 text-[10px] font-extrabold text-raspberry-700"><LoaderCircle size={11} className="animate-spin" /> Memuat gambar...</span> : <span className="mr-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700"><b>{readyCount}</b> siap</span>}
          <button className="app-button h-8 px-2.5 text-[10px]" disabled={!assets.some((asset) => asset.status === "completed")} onClick={onClearCompleted}>Hapus selesai</button>
          <button className="app-button h-8 px-2.5 text-[10px]" disabled={!assets.length || isGenerating} onClick={onClearAll}>Hapus semua</button>
          <button className="app-button h-8 px-2.5 text-[10px]" disabled={!failedCount || isGenerating} onClick={onRetryFailed}><RotateCcw size={12} /> Coba lagi {failedCount ? `(${failedCount})` : ""}</button>
        </div>
      </div>
      {selectedAssetIds.length ? <div className="flex flex-wrap items-center gap-2.5 border-b border-raspberry-200 bg-raspberry-50/70 px-6 py-3">
        <span className="mr-1 rounded-full bg-raspberry-600 px-2.5 py-1 text-[11px] font-extrabold text-white">{selectedAssetIds.length} selected</span>
        <div className="flex items-center gap-1.5"><Tag size={13} className="text-raspberry-600" /><select className="app-select h-8 w-[190px] text-[11px]" value={category} onChange={(event) => setCategory(Number(event.target.value))}><option value={8}>Atur kategori…</option>{ADOBE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.id} — {item.name}</option>)}</select><button className="app-button h-8 px-2.5 text-[11px]" onClick={() => onSetCategory(category)}>Terapkan</button></div>
        <div className="flex items-center gap-1.5"><input className="app-input h-8 w-[130px] text-[11px]" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitAdd(); }} placeholder="Tambah keyword" /><button className="app-button h-8 px-2.5 text-[11px]" onClick={submitAdd}>Tambah</button></div>
        <div className="flex items-center gap-1.5"><input className="app-input h-8 w-[130px] text-[11px]" value={removeKeyword} onChange={(event) => setRemoveKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitRemove(); }} placeholder="Hapus keyword" /><button className="app-button h-8 px-2.5 text-[11px]" onClick={submitRemove}><X size={12} /> Hapus</button></div>
        <button className="app-button app-button-primary h-8 px-2.5 text-[11px]" onClick={onRegenerate}><RotateCcw size={12} /> Generate ulang</button>
      </div> : null}
      {assets.length === 0 ? <TableEmpty onDrop={onDrop} onChoose={onChoose} /> : <div className={`${tableHeight} overflow-auto`}><table className="w-full min-w-[760px] border-collapse text-left"><thead className="sticky top-0 z-10 bg-raspberry-50/90 text-[10px] font-extrabold uppercase tracking-wider text-raspberry-700 backdrop-blur-sm"><tr className="border-b border-raspberry-100"><th className="w-12 px-5 py-3.5"><button aria-label="Pilih semua aset" onClick={onSelectAll} className="flex items-center justify-center text-raspberry-500">{allSelected ? <CheckCircle2 size={16} className="text-raspberry-600" /> : selectedAssetIds.length ? <Minus size={16} className="text-raspberry-600" /> : <Square size={15} />}</button></th><th className="w-20 px-2 py-3.5">Preview</th><th className="px-2 py-3.5">Nama file</th><th className="min-w-[260px] px-2 py-3.5">Title</th><th className="w-32 px-2 py-3.5">Keywords</th><th className="w-36 px-2 py-3.5">Kategori</th><th className="w-24 px-2 py-3.5">Nilai</th><th className="w-16 px-2 py-3.5">Aksi</th></tr></thead><tbody>{assets.map((asset) => <MetadataRow key={asset.id} asset={asset} isGenerating={isGenerating} selected={asset.id === selectedAssetId} checked={selectedAssetIds.includes(asset.id)} onSelect={onSelect} onToggle={onToggle} onRemove={onRemove} />)}</tbody></table><div className="mx-4 my-4 rounded-xl border border-dashed border-raspberry-200 bg-raspberry-50/40 px-3 py-3 text-center" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}><p className="text-[11px] font-semibold text-raspberry-600">Tarik gambar lain ke sini untuk menambah</p></div></div>}
    </section>
  );
}

function MetadataRow({ asset, isGenerating, selected, checked, onSelect, onToggle, onRemove }: { asset: StockAsset; isGenerating: boolean; selected: boolean; checked: boolean; onSelect: (id: string) => void; onToggle: (id: string) => void; onRemove: (id: string) => void }) {
  const metadata = asset.metadata;
  const isLoading = isGenerating && (asset.status === "queued" || asset.status === "preparing" || asset.status === "processing");
  const loadingLabel = asset.status === "queued" ? "Menunggu antrean" : asset.status === "preparing" ? "Menyiapkan gambar" : "Sedang generate";
  return <tr aria-selected={selected} className={`group cursor-pointer border-b border-raspberry-50 transition hover:bg-raspberry-50/50 ${selected ? "bg-raspberry-50/80" : ""}`} onClick={() => onSelect(asset.id)}>
    <td className={`px-5 py-3.5 ${selected ? "border-l-4 border-l-raspberry-600 pl-4" : ""}`} onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Pilih ${asset.filename}`} checked={checked} onChange={() => onToggle(asset.id)} className="h-4 w-4 accent-raspberry-600" /></td>
    <td className="px-2 py-3.5"><div className={`relative flex h-12 w-16 items-center justify-center overflow-hidden rounded-xl border bg-raspberry-50 ${selected ? "border-raspberry-500 ring-2 ring-raspberry-300 ring-offset-1" : "border-raspberry-100"}`}>{asset.previewUrl ? <img src={asset.previewUrl} alt="" className="h-full w-full object-contain" /> : <FileImage size={16} className="text-raspberry-400" />}{isLoading ? <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45"><LoaderCircle size={17} className="animate-spin text-white" /></div> : null}{selected ? <span className="absolute bottom-0.5 left-0.5 rounded bg-raspberry-600 px-1 text-[8px] font-extrabold text-white">Dipilih</span> : null}</div></td>
    <td className="max-w-[170px] px-2 py-3.5"><p className="truncate text-[12px] font-bold text-slate-900" title={asset.filename}>{asset.filename}</p><p className="mt-1 text-[10px] font-medium text-slate-400">{asset.width} × {asset.height}</p></td>
    <td className="max-w-[290px] px-2 py-3.5"><p className={`truncate text-[12px] leading-snug ${metadata?.title ? "font-semibold text-slate-900" : "italic text-slate-400"}`}>{metadata?.title || (isLoading ? loadingLabel : "Belum ada metadata")}</p>{isLoading ? <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-raspberry-700"><LoaderCircle size={11} className="animate-spin" />{loadingLabel}</p> : metadata?.warnings.length ? <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-700"><AlertCircle size={12} />{metadata.warnings.length} hal perlu dicek</p> : null}</td>
    <td className="px-2 py-3.5"><span className="rounded-full border border-raspberry-200 bg-raspberry-50 px-2.5 py-1 text-[10px] font-extrabold text-raspberry-700">{metadata ? `${metadata.keywords.length} keyword` : "—"}</span></td>
    <td className="px-2 py-3.5 text-[11px] text-slate-700">{metadata ? <><span className="block truncate font-semibold">{categoryName(metadata.category)}</span><span className="mt-0.5 block text-[10px] text-slate-400">Kategori {metadata.category}</span></> : "—"}</td>
    <td className="px-2 py-3.5">{metadata ? <div><span className={`text-[15px] font-extrabold ${metadata.qualityScore >= 90 ? "text-emerald-600" : metadata.qualityScore >= 70 ? "text-amber-600" : "text-raspberry-700"}`}>{metadata.qualityScore}</span><span className="mt-0.5 block text-[10px] font-medium text-slate-400">{metadataLabel(metadata.qualityScore)}</span></div> : "—"}</td>
    <td className="px-2 py-3.5"><div className="flex items-center justify-end gap-1"><button className="invisible rounded-lg p-1.5 text-slate-400 hover:bg-raspberry-100 hover:text-raspberry-700 group-hover:visible" aria-label={`Hapus ${asset.filename}`} onClick={(event) => { event.stopPropagation(); onRemove(asset.id); }}><Trash2 size={14} /></button><ChevronRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-raspberry-600" /></div></td>
  </tr>;
}

function TableEmpty({ onDrop, onChoose }: { onDrop: (event: React.DragEvent<HTMLDivElement>) => void; onChoose: () => void }) {
  return <div className="flex h-[calc(100%-76px)] items-center justify-center bg-raspberry-50/20" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}><div className="max-w-[410px] rounded-2xl border border-dashed border-raspberry-200 bg-raspberry-50/40 px-8 py-8 text-center"><h2 className="mt-2 text-[17px] font-extrabold text-slate-900">Tambahkan gambar pertama</h2><p className="mt-2 text-[12px] leading-6 text-slate-500">Tarik file JPG, PNG, atau WebP ke sini, atau pilih file untuk mulai membuat metadata.</p><button className="app-button app-button-primary mt-5 h-9 px-4 text-[11px]" onClick={onChoose}><ImagePlus size={14} /> Pilih gambar</button></div></div>;
}
