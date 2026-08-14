import { Clipboard, FileImage, Plus, RotateCcw, X } from "lucide-react";
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
  if (!asset || !metadata) return <aside className="flex w-[350px] shrink-0 flex-col overflow-hidden rounded-2xl border border-raspberry-100 bg-surface shadow-panel"><div className="flex flex-1 items-center justify-center bg-raspberry-50/30 p-8 text-center"><div><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-raspberry-400 shadow-sm"><FileImage size={21} /></div><p className="eyebrow mt-4">Inspector</p><p className="mt-2 text-[12px] leading-6 text-slate-500">Pilih baris aset untuk mengedit title, kategori, dan keyword prioritas.</p></div></div></aside>;

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

  return <aside className="flex w-[350px] shrink-0 flex-col overflow-hidden rounded-2xl border border-raspberry-100 bg-surface shadow-panel">
    <div className="flex h-[76px] items-center justify-between border-b border-raspberry-100 px-5"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-raspberry-50 text-raspberry-600"><Clipboard size={16} /></div><div className="min-w-0"><p className="eyebrow">Inspector</p><p className="mt-1 truncate text-[12px] font-extrabold text-slate-900" title={asset.filename}>{asset.filename}</p></div></div><button className="app-button app-button-quiet h-8 w-8 px-0" onClick={onClose} aria-label="Tutup Inspector"><X size={17} /></button></div>
    <div className="min-h-0 flex-1 overflow-y-auto bg-raspberry-50/20 p-5">
      <div className="flex h-[176px] items-center justify-center overflow-hidden rounded-2xl border border-raspberry-100 bg-surface-muted p-2 shadow-sm">{asset.previewUrl ? <img src={asset.previewUrl} alt={asset.filename} className="max-h-full max-w-full object-contain" /> : <FileImage size={28} className="text-raspberry-300" />}</div>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-raspberry-100 bg-surface px-3.5 py-3"><div><p className="text-[12px] font-extrabold text-slate-900">{asset.width} × {asset.height}</p><p className="mt-0.5 text-[10px] font-medium text-slate-500">{formatBytes(asset.fileSize)} · {asset.mimeType.replace("image/", "").toUpperCase()}</p></div><ScoreBadge score={metadata.qualityScore} /></div>
      <div className="my-5 h-px bg-raspberry-100" />
      <label className="block"><div className="flex items-center justify-between"><span className="text-[12px] font-extrabold text-slate-900">Title</span><div className="flex items-center gap-2"><button className="text-[11px] font-bold text-raspberry-700 hover:text-raspberry-900" onClick={() => copy(metadata.title)}>Salin</button><span className={`text-[10px] font-semibold ${metadata.title.length > 70 ? "text-rose-600" : "text-slate-400"}`}>{metadata.title.length}/70</span></div></div><input className="app-input mt-2 text-[12px]" value={metadata.title} onChange={(event) => commit({ title: event.target.value })} placeholder="Jelaskan isi utama yang terlihat" /></label>
      <div className="mt-4"><label className="text-[12px] font-extrabold text-slate-900">Kategori</label><select className="app-input mt-2 text-[12px]" value={metadata.category} onChange={(event) => commit({ category: Number(event.target.value) })}>{ADOBE_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.id} — {category.name}</option>)}</select><p className="mt-1.5 text-[10px] font-medium text-slate-500">Saat ini: {categoryName(metadata.category)}</p></div>
      <div className="mt-5"><div className="flex items-center justify-between"><div><span className="text-[12px] font-extrabold text-slate-900">Keywords</span><span className="ml-2 text-[10px] font-medium text-slate-400">{metadata.keywords.length} · 10 pertama jadi prioritas</span></div><button className="app-button app-button-quiet h-7 px-2.5 text-[10px]" onClick={() => copy(metadata.keywords.join(", "))}><Clipboard size={13} /> Salin</button></div>
        <div className="mt-2.5 flex min-h-[72px] flex-wrap content-start gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-inner">
          {metadata.keywords.map((keyword, index) => <div key={`${keyword}-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) moveKeyword(dragIndex, index); setDragIndex(null); }} className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold leading-none transition ${index < 10 ? "border-raspberry-200 bg-raspberry-50 text-raspberry-900" : "border-slate-200 bg-slate-100 text-slate-700"}`} title="Tarik untuk mengubah urutan">
            <span className="max-w-[220px] truncate">{keyword}</span>
            <button className="shrink-0 text-slate-400 transition hover:text-rose-600" onClick={() => commit({ keywords: metadata.keywords.filter((_, keywordIndex) => keywordIndex !== index) })} aria-label={`Hapus keyword ${keyword}`}><X size={11} /></button>
          </div>)}
        </div>
        <div className="mt-2.5 flex gap-2"><input className="app-input h-8 text-[11px]" value={newKeyword} onChange={(event) => setNewKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addKeyword(); }} placeholder="Tambah keyword" /><button className="app-button app-button-primary h-8 w-8 px-0" onClick={addKeyword} aria-label="Tambah keyword"><Plus size={15} /></button></div>
      </div>
      <div className="mt-5"><label className="text-[12px] font-extrabold text-slate-900">Sumber konten</label><select className="app-input mt-2 text-[12px]" value={metadata.contentSource} onChange={(event) => commit({ contentSource: event.target.value as ContentSource })}><option value="standard">Biasa</option><option value="generative-ai">AI generatif</option></select><p className="mt-1.5 text-[10px] leading-5 text-slate-500">Ini hanya penanda dari Anda, bukan hasil deteksi otomatis asal gambar.</p></div>
      <button className="app-button mt-5 h-9 w-full text-[11px] font-semibold" onClick={() => copy(`${metadata.title}\n${metadata.keywords.join(", ")}\n${metadata.category}`)}><Clipboard size={13} /> Salin metadata</button>
      {metadata.warnings.length ? <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3.5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Perlu dicek</p><ul className="mt-1.5 space-y-1">{metadata.warnings.map((warning) => <li key={warning.code} className="text-[10px] leading-5 text-amber-900">{warning.message}</li>)}</ul></div> : null}
    </div>
    <div className="border-t border-raspberry-100 bg-surface p-4"><div className="grid grid-cols-4 gap-1.5"><button className="app-button h-8 px-1 text-[10px]" disabled={!asset.previousMetadata} onClick={() => onUndo(asset.id)}>Urungkan</button><button className="app-button h-8 px-1 text-[10px]" onClick={() => onRegenerate(asset.id, "title")}><RotateCcw size={12} /> Title</button><button className="app-button h-8 px-1 text-[10px]" onClick={() => onRegenerate(asset.id, "keywords")}><RotateCcw size={12} /> Keywords</button><button className="app-button app-button-primary h-8 px-1 text-[10px]" onClick={() => onRegenerate(asset.id, "full")}><RotateCcw size={12} /> Semua</button></div></div>
  </aside>;
}

function ScoreBadge({ score }: { score: number }) { return <div className="text-right"><p className={`text-[21px] font-black leading-none ${score >= 90 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-raspberry-700"}`}>{score}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">nilai kualitas</p></div>; }
function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
