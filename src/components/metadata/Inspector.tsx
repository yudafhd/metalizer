import { Clipboard, FileImage, Film, LoaderCircle, Plus, RotateCcw, Undo2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ADOBE_CATEGORIES, categoryName } from "../../constants/categories";
import type { MetadataMode, StockAsset, StockMetadata } from "../../types";
import { emptyMetadata, qualityScore, validateMetadata } from "../../utils/metadata";
import { formatDuration, isVideoMime, isVideoPath } from "../../services/video";
import { VideoFrameModal } from "./VideoFrameModal";

interface InspectorProps {
  asset?: StockAsset;
  mode: MetadataMode;
  onClose: () => void;
  onUpdate: (assetId: string, metadata: StockMetadata) => void;
  onRegenerate: (assetId: string, scope: "full" | "title" | "keywords") => void;
  onUndo: (assetId: string) => void;
  onSaveVideoFrames: (assetId: string, times: number[], coverTime: number) => Promise<void>;
}

export function Inspector({ asset, mode, onClose, onUpdate, onRegenerate, onUndo, onSaveVideoFrames }: InspectorProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [frameModalOpen, setFrameModalOpen] = useState(false);
  const [activePreviewTime, setActivePreviewTime] = useState<number>();
  const metadata = useMemo(() => asset?.metadata ?? (asset ? emptyMetadata(asset, mode) : undefined), [asset, mode]);

  if (!asset || !metadata) {
    return (
      <aside className="flex w-[350px] shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
        <div className="flex flex-1 items-center justify-center bg-surface-sunken/40 p-8 text-center">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-accent-500 shadow-sm border border-line-subtle">
              <FileImage size={22} />
            </div>
            <p className="eyebrow mt-4">Inspector</p>
            <p className="mt-2 text-[12px] leading-6 text-ink-muted">
              Pilih baris aset di Workspace untuk mengedit title, category, dan keyword prioritas.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const commit = (patch: Partial<StockMetadata>) => {
    const next = { ...metadata, ...patch };
    const validation = validateMetadata(asset.filename, next);
    onUpdate(asset.id, {
      ...next,
      keywords: validation.normalizedKeywords,
      warnings: validation.warnings,
      qualityScore: qualityScore({ ...next, keywords: validation.normalizedKeywords }, validation),
    });
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
  const isVideo = asset.mediaType === "video" || isVideoMime(asset.mimeType) || isVideoPath(asset.path);
  const framePreviews = isVideo ? asset.videoFramePreviews ?? [] : [];
  const coverFrame = framePreviews.find((frame) => Math.abs(frame.time - (asset.videoCoverTime ?? framePreviews[0]?.time)) < 0.5);
  const activeFrame = framePreviews.find((frame) => frame.time === activePreviewTime) ?? coverFrame;

  return (
    <>
    <aside className="flex w-[350px] shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
      <div className="flex h-[72px] items-center justify-between border-b border-line px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            <Clipboard size={16} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Inspector</p>
            <p className="mt-0.5 truncate text-[12px] font-extrabold text-ink" title={asset.filename}>
              {asset.filename}
            </p>
          </div>
        </div>
        <button className="app-button app-button-quiet h-8 w-8 px-0" onClick={onClose} aria-label="Tutup Inspector">
          <X size={17} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunken/20 p-5">
        <div className="flex h-[176px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-sunken p-2 shadow-sm" role={isVideo && asset.videoPreviewStatus === "loading" ? "status" : undefined}>
          {activeFrame?.imageUrl || asset.previewUrl ? (
            <img src={activeFrame?.imageUrl ?? asset.previewUrl} alt={activeFrame ? `${asset.filename} pada ${formatDuration(activeFrame.time)}` : asset.filename} className="max-h-full max-w-full object-contain" />
          ) : isVideo && asset.videoPreviewStatus === "loading" ? (
            <div className="flex flex-col items-center gap-2 text-accent-500">
              <LoaderCircle size={26} className="animate-spin" />
              <span className="text-[11px] font-semibold">Memuat pratinjau video...</span>
            </div>
          ) : isVideo && asset.videoPreviewStatus === "error" ? (
            <div className="flex flex-col items-center gap-2 text-amber-500" title={asset.videoPreviewError}>
              <Film size={26} />
              <span className="text-[11px] font-semibold">Pratinjau video gagal</span>
            </div>
          ) : isVideo ? (
            <Film size={28} className="text-accent-300" />
          ) : (
            <FileImage size={28} className="text-accent-300" />
          )}
        </div>
        {framePreviews.length ? (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-ink-muted">
              <span>{asset.videoFrameTimes?.length ? "Titik gambar dipilih" : "Titik gambar otomatis"}</span>
              <span>{framePreviews.length} gambar</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {framePreviews.map((frame, index) => (
                <button
                  key={`${frame.time}-${index}`}
                  type="button"
                  className={`relative overflow-hidden rounded-lg border bg-surface-sunken transition-colors ${activeFrame?.time === frame.time ? "border-accent-500 ring-1 ring-accent-500/40" : "border-line hover:border-accent-500/60"}`}
                  onClick={() => setActivePreviewTime(frame.time)}
                  aria-label={`Lihat gambar video pada ${formatDuration(frame.time)}${coverFrame?.time === frame.time ? ", gambar utama" : ""}`}
                  aria-pressed={activeFrame?.time === frame.time}
                >
                  <img src={frame.imageUrl} alt="" className="aspect-video w-full object-contain" />
                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/75 px-1 text-[9px] font-bold tabular-nums text-white">{formatDuration(frame.time)}</span>
                  {coverFrame?.time === frame.time ? <span className="absolute left-0 top-0 rounded-br bg-accent-600 px-1 text-[8px] font-bold text-white">Utama</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {isVideo ? (
          <button type="button" className="app-button mt-2.5 w-full text-[11px]" onClick={() => setFrameModalOpen(true)} disabled={asset.status === "processing" || asset.status === "preparing" || asset.videoPreviewStatus === "loading"}>
            <Film size={14} /> Pilih titik gambar video
          </button>
        ) : null}

        <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-3 shadow-sm">
          <div>
            <p className="text-[12px] font-extrabold text-ink">
              {asset.width > 0 ? `${asset.width} × ${asset.height}` : "Video"}
              {asset.duration ? ` · ${formatDuration(asset.duration)}` : ""}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-ink-muted">
              {formatBytes(asset.fileSize)} · {asset.mimeType.replace(/^(image|video)\//, "").toUpperCase()}
            </p>
          </div>
          <ScoreBadge score={metadata.qualityScore} />
        </div>

        <div className="my-4 h-px bg-line-subtle" />

        <label className="block">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[12px] font-extrabold text-ink">Title</span>
              <span className={`ml-2 text-[10px] font-medium ${metadata.title.length > 70 ? "text-rose-600 font-semibold" : "text-ink-muted"}`}>
                {metadata.title.length}/70
              </span>
            </div>
            <button
              type="button"
              className="app-button app-button-quiet h-7 px-2 text-[10px]"
              onClick={() => copy(metadata.title)}
            >
              <Clipboard size={12} /> Salin
            </button>
          </div>
          <input
            className="app-input mt-2 text-[12px]"
            value={metadata.title}
            onChange={(event) => commit({ title: event.target.value })}
            placeholder="Jelaskan subjek utama yang terlihat"
          />
        </label>

        <div className="mt-4">
          <label className="text-[12px] font-extrabold text-ink">Category</label>
          <select
            className="app-select mt-2 text-[12px]"
            value={metadata.category}
            onChange={(event) => commit({ category: Number(event.target.value) })}
          >
            {ADOBE_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.id} — {category.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] font-medium text-ink-muted">Saat ini: {categoryName(metadata.category)}</p>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[12px] font-extrabold text-ink">Keywords</span>
              <span className="ml-2 text-[10px] font-medium text-ink-muted">
                {metadata.keywords.length} · 10 awal prioritas
              </span>
            </div>
            <button
              type="button"
              className="app-button app-button-quiet h-7 px-2 text-[10px]"
              onClick={() => copy(metadata.keywords.join(", "))}
            >
              <Clipboard size={12} /> Salin
            </button>
          </div>

          <div className="mt-2 flex min-h-[72px] flex-wrap content-start gap-1.5 rounded-xl border border-line bg-surface p-2.5 shadow-inner">
            {metadata.keywords.map((keyword, index) => (
              <div
                key={`${keyword}-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) moveKeyword(dragIndex, index);
                  setDragIndex(null);
                }}
                className={index < 10 ? "tag-chip-priority" : "tag-chip"}
                title="Tarik untuk mengubah urutan prioritas"
              >
                <span className="max-w-[200px] truncate">{keyword}</span>
                <button
                  type="button"
                  className="shrink-0 text-ink-muted transition hover:text-rose-600"
                  onClick={() => commit({ keywords: metadata.keywords.filter((_, keywordIndex) => keywordIndex !== index) })}
                  aria-label={`Hapus keyword ${keyword}`}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>

          <div className="relative mt-2.5">
            <input
              className="app-input h-9 pr-11 text-[11px]"
              value={newKeyword}
              onChange={(event) => setNewKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addKeyword();
              }}
              placeholder="Tambah kata kunci"
            />
            <button
              type="button"
              className="app-button app-button-primary absolute right-1 top-1 h-7 w-7 rounded-lg px-0"
              onClick={addKeyword}
              disabled={!newKeyword.trim()}
              aria-label="Tambah kata kunci"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        <button
          className="app-button mt-4 h-9 w-full text-[11px] font-semibold"
          onClick={() => copy(`${metadata.title}\n${metadata.keywords.join(", ")}\n${metadata.category}`)}
        >
          <Clipboard size={13} /> Salin semua metadata
        </button>

        {metadata.warnings.length ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500">Perlu dicek</p>
            <ul className="mt-1.5 space-y-1">
              {metadata.warnings.map((warning) => (
                <li key={warning.code} className="text-[10px] leading-4 text-ink">
                  {warning.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="border-t border-line bg-surface p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">Generate ulang</span>
          <button
            className="app-button app-button-quiet h-7 px-2 text-[10px]"
            disabled={!asset.previousMetadata}
            onClick={() => onUndo(asset.id)}
            aria-label={`Urungkan metadata untuk ${asset.filename}`}
          >
            <Undo2 size={12} /> Urung
          </button>
        </div>
        <div className="grid grid-cols-[0.8fr_1.1fr_1.5fr] gap-1.5">
          <button
            className="app-button h-8 px-1 text-[10px]"
            onClick={() => onRegenerate(asset.id, "title")}
            aria-label={`Generate ulang judul untuk ${asset.filename}`}
          >
            <RotateCcw size={12} /> Judul
          </button>
          <button
            className="app-button h-8 px-1 text-[10px]"
            onClick={() => onRegenerate(asset.id, "keywords")}
            aria-label={`Generate ulang kata kunci untuk ${asset.filename}`}
          >
            <RotateCcw size={12} /> Kata kunci
          </button>
          <button
            className="app-button app-button-primary h-8 px-1 text-[10px]"
            onClick={() => onRegenerate(asset.id, "full")}
            aria-label={`Generate ulang semua metadata untuk ${asset.filename}`}
          >
            <RotateCcw size={12} /> Semua metadata
          </button>
        </div>
      </div>
    </aside>
    {frameModalOpen && isVideo ? (
      <VideoFrameModal key={asset.id} asset={asset} onClose={() => setFrameModalOpen(false)} onSave={(times, coverTime) => onSaveVideoFrames(asset.id, times, coverTime)} />
    ) : null}
    </>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <div className="text-right">
      <p
        className={`text-[20px] font-black leading-none ${
          score >= 90 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-accent-700"
        }`}
      >
        {score}
      </p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-muted">nilai kualitas</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
