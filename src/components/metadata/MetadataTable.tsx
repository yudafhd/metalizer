import { AlertCircle, CheckCheck, CheckCircle2, ChevronDown, FileImage, FolderOpen, Images, LoaderCircle, Minus, RotateCcw, Square, Tag, Trash2, Video, X } from "lucide-react";
import { useState } from "react";

import { ADOBE_CATEGORIES, categoryName } from "../../constants/categories";
import { AdditionalPromptBar } from "./AdditionalPromptBar";
import type { AssetMediaType, StockAsset } from "../../types";
import { metadataLabel } from "../../utils/metadata";
import { formatDuration, isVideoPath } from "../../services/video";

interface MetadataTableProps {
  assets: StockAsset[];
  selectedAssetId?: string;
  selectedAssetIds: string[];
  isGenerating: boolean;
  isAddingAssets: boolean;
  additionalPrompt: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
  onRetryFailed: () => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onChoose: (mediaType: AssetMediaType) => void;
  onAddFolder: (mediaType: AssetMediaType) => void;
  onSelectAll: () => void;
  onSetCategory: (category: number) => void;
  onAddKeyword: (keyword: string) => void;
  onRemoveKeyword: (keyword: string) => void;
  onRegenerate: () => void;
  onAdditionalPromptChange: (value: string) => void;
}

export function MetadataTable({
  assets,
  selectedAssetId,
  selectedAssetIds,
  isGenerating,
  isAddingAssets,
  additionalPrompt,
  onSelect,
  onToggle,
  onRemove,
  onClearCompleted,
  onClearAll,
  onRetryFailed,
  onDrop,
  onChoose,
  onAddFolder,
  onSelectAll,
  onSetCategory,
  onAddKeyword,
  onRemoveKeyword,
  onRegenerate,
  onAdditionalPromptChange,
}: MetadataTableProps) {
  const allSelected = assets.length > 0 && selectedAssetIds.length === assets.length;
  const [category, setCategory] = useState(8);
  const [keyword, setKeyword] = useState("");
  const [removeKeyword, setRemoveKeyword] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const workspaceTypes = new Set<AssetMediaType>(assets.map((asset) => asset.mediaType ?? (isVideoPath(asset.path) ? "video" : "image")));
  const canAddType = (mediaType: AssetMediaType) => !isAddingAssets && (workspaceTypes.size === 0 || (workspaceTypes.size === 1 && workspaceTypes.has(mediaType)));

  const submitAdd = () => {
    if (keyword.trim()) {
      onAddKeyword(keyword.trim());
      setKeyword("");
    }
  };

  const submitRemove = () => {
    if (removeKeyword.trim()) {
      onRemoveKeyword(removeKeyword.trim());
      setRemoveKeyword("");
    }
  };

  const readyCount = assets.filter((asset) => asset.metadata).length;
  const failedCount = assets.filter((asset) => asset.status === "failed").length;
  const completedCount = assets.filter((asset) => asset.status === "completed").length;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
      <div className="flex min-h-[72px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3">
        <div className="flex items-center gap-3">
          <p className="eyebrow">Workspace</p>
          {isAddingAssets ? (
            <span className="flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-[10px] font-extrabold text-accent-700">
              <LoaderCircle size={11} className="animate-spin" /> Memuat...
            </span>
          ) : (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
              <b>{readyCount}</b> siap
            </span>
          )}
        </div>

        <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
          <button className="app-button app-button-primary h-8 px-2.5 text-[11px]" disabled={!canAddType("image")} onClick={() => onChoose("image")} title={canAddType("image") ? "Pilih gambar" : "Kosongkan workspace video sebelum menambah gambar"}>
            {isAddingAssets ? <LoaderCircle size={13} className="animate-spin" /> : <FileImage size={13} />} Gambar
          </button>
          <button
            className="app-button h-8 px-2.5 text-[11px]"
            disabled={!canAddType("video")}
            onClick={() => onChoose("video")}
            title={canAddType("video") ? "Pilih video" : "Kosongkan workspace gambar sebelum menambah video"}
          >
            {isAddingAssets ? <LoaderCircle size={13} className="animate-spin" /> : <Video size={13} />} Video
          </button>
          <div className="relative">
            <button type="button" className="app-button h-8 px-2.5 text-[11px]" disabled={isAddingAssets || workspaceTypes.size > 1} onClick={() => setFolderMenuOpen((open) => !open)} aria-expanded={folderMenuOpen} aria-haspopup="menu" title="Pilih folder gambar atau video">
              <FolderOpen size={13} /> Folder <ChevronDown size={11} className={`transition-transform ${folderMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {folderMenuOpen ? (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setFolderMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-line bg-surface p-1 shadow-modal" role="menu">
                  <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-ink hover:bg-surface-sunken disabled:opacity-40" disabled={!canAddType("image")} onClick={() => { setFolderMenuOpen(false); onAddFolder("image"); }}><FileImage size={14} /> Folder gambar</button>
                  <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-ink hover:bg-surface-sunken disabled:opacity-40" disabled={!canAddType("video")} onClick={() => { setFolderMenuOpen(false); onAddFolder("video"); }}><Video size={14} /> Folder video</button>
                </div>
              </>
            ) : null}
          </div>

          {failedCount > 0 && (
            <button
              className="app-button h-8 px-2.5 text-[11px] font-bold border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
              disabled={isGenerating}
              onClick={onRetryFailed}
              title={`Coba lagi ${failedCount} gambar yang gagal`}
            >
              <RotateCcw size={13} /> Coba lagi ({failedCount})
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              className="app-button h-8 px-2.5 text-[11px] text-ink-muted hover:text-ink transition-colors"
              disabled={!assets.length || isGenerating}
              onClick={() => setActionMenuOpen((open) => !open)}
              title="Kelola & bersihkan daftar gambar"
            >
              <Trash2 size={13} /> Bersihkan <ChevronDown size={11} className={`transition-transform ${actionMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {actionMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setActionMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-modal">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-ink hover:bg-surface-sunken transition disabled:opacity-40 disabled:hover:bg-transparent"
                    disabled={!completedCount}
                    onClick={() => {
                      onClearCompleted();
                      setActionMenuOpen(false);
                    }}
                  >
                    <CheckCheck size={14} className="text-emerald-600" />
                    <span className="flex-1">Hapus yang selesai</span>
                    <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[9px] font-bold text-ink-muted">
                      {completedCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition"
                    onClick={() => {
                      onClearAll();
                      setActionMenuOpen(false);
                    }}
                  >
                    <Trash2 size={14} className="text-rose-500" />
                    <span className="flex-1">Kosongkan semua</span>
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                      {assets.length}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <AdditionalPromptBar value={additionalPrompt} onChange={onAdditionalPromptChange} />

      {selectedAssetIds.length ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-accent-200 bg-accent-50/80 px-6 py-2.5">
          <span className="mr-1 rounded-full bg-accent-600 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
            {selectedAssetIds.length} dipilih
          </span>
          <div className="flex items-center gap-1.5">
            <Tag size={13} className="text-accent-600" />
            <select
              className="app-select h-8 w-[190px] text-[11px]"
              value={category}
              onChange={(event) => setCategory(Number(event.target.value))}
            >
              <option value={8}>Set category…</option>
              {ADOBE_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} — {item.name}
                </option>
              ))}
            </select>
            <button className="app-button h-8 px-2.5 text-[11px]" onClick={() => onSetCategory(category)}>
              Terapkan
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              className="app-input h-8 w-[130px] text-[11px]"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitAdd();
              }}
              placeholder="Tambah keyword"
            />
            <button className="app-button h-8 px-2.5 text-[11px]" onClick={submitAdd}>
              Tambah
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              className="app-input h-8 w-[130px] text-[11px]"
              value={removeKeyword}
              onChange={(event) => setRemoveKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitRemove();
              }}
              placeholder="Hapus keyword"
            />
            <button className="app-button h-8 px-2.5 text-[11px]" onClick={submitRemove}>
              <X size={12} /> Hapus
            </button>
          </div>
          <button className="app-button app-button-primary h-8 px-2.5 text-[11px]" onClick={onRegenerate}>
            <RotateCcw size={12} /> Generate ulang
          </button>
        </div>
      ) : null}

      {assets.length === 0 ? (
        <div className="min-h-0 flex-1">
          <TableEmpty onDrop={onDrop} onChoose={onChoose} isAddingAssets={isAddingAssets} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface-sunken/95 text-[10px] font-extrabold uppercase tracking-wider text-accent-700 backdrop-blur-sm">
              <tr>
                <th className="w-12 px-5 py-3.5">
                  <button
                    aria-label="Pilih semua aset"
                    onClick={onSelectAll}
                    className="flex items-center justify-center text-accent-500 hover:text-accent-700 transition"
                  >
                    {allSelected ? (
                      <CheckCircle2 size={16} className="text-accent-600" />
                    ) : selectedAssetIds.length ? (
                      <Minus size={16} className="text-accent-600" />
                    ) : (
                      <Square size={15} />
                    )}
                  </button>
                </th>
                <th className="w-20 px-2 py-3.5">Preview</th>
                <th className="px-2 py-3.5">Nama file</th>
                <th className="min-w-[260px] px-2 py-3.5">Title</th>
                <th className="w-32 px-2 py-3.5">Keywords</th>
                <th className="w-36 px-2 py-3.5">Category</th>
                <th className="w-24 px-2 py-3.5">Nilai</th>
                <th className="w-16 px-2 py-3.5">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <MetadataRow
                  key={asset.id}
                  asset={asset}
                  isGenerating={isGenerating}
                  selected={asset.id === selectedAssetId}
                  checked={selectedAssetIds.includes(asset.id)}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  onRemove={onRemove}
                />
              ))}
            </tbody>
          </table>
          <div
            className="mx-4 my-4 rounded-xl border border-dashed border-accent-300 bg-accent-50/40 px-3 py-3 text-center transition hover:bg-accent-50/70"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
          >
            <p className="text-[11px] font-semibold text-accent-700">Tarik {workspaceTypes.has("video") ? "video" : "gambar"} lain ke sini untuk menambah antrean</p>
          </div>
        </div>
      )}
    </section>
  );
}

function MetadataRow({
  asset,
  isGenerating,
  selected,
  checked,
  onSelect,
  onToggle,
  onRemove,
}: {
  asset: StockAsset;
  isGenerating: boolean;
  selected: boolean;
  checked: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const metadata = asset.metadata;
  const isLoading = isGenerating && (asset.status === "queued" || asset.status === "preparing" || asset.status === "processing");
  const previewLoading = asset.mediaType === "video" && asset.videoPreviewStatus === "loading";
  const loadingLabel = asset.status === "queued" ? "Menunggu antrean" : asset.status === "preparing" ? "Menyiapkan gambar" : "Sedang generate";

  return (
    <tr
      aria-selected={selected}
      className={`group cursor-pointer border-b border-line-subtle transition hover:bg-accent-50/40 ${
        selected ? "bg-accent-50/80" : ""
      }`}
      onClick={() => onSelect(asset.id)}
    >
      <td
        className={`px-5 py-3.5 ${selected ? "border-l-4 border-l-accent-600 pl-4" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          aria-label={`Pilih ${asset.filename}`}
          checked={checked}
          onChange={() => onToggle(asset.id)}
          className="h-4 w-4 accent-accent-600"
        />
      </td>
      <td className="px-2 py-3.5">
        <div
          className={`relative flex h-12 w-16 items-center justify-center overflow-hidden rounded-xl border bg-surface-sunken ${
            selected ? "border-accent-500 ring-2 ring-accent-300 ring-offset-1" : "border-line"
          }`}
        >
          {asset.previewUrl ? (
            <img src={asset.previewUrl} alt="" className="h-full w-full object-contain" />
          ) : asset.mediaType === "video" ? (
            <Video size={16} className="text-accent-400" />
          ) : (
            <FileImage size={16} className="text-accent-400" />
          )}
          {asset.mediaType === "video" ? (
            <span className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[7px] font-bold text-white backdrop-blur-[1px]">
              {asset.duration ? formatDuration(asset.duration) : "VIDEO"}
            </span>
          ) : null}
          {isLoading || previewLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/40 backdrop-blur-[1px]">
              <LoaderCircle size={17} className="animate-spin text-white" />
            </div>
          ) : null}
          {selected ? (
            <span className="absolute bottom-0.5 left-0.5 rounded bg-accent-600 px-1 text-[8px] font-extrabold text-white">
              Dipilih
            </span>
          ) : null}
        </div>
      </td>
      <td className="max-w-[170px] px-2 py-3.5">
        <p className="truncate text-[12px] font-bold text-ink" title={asset.filename}>
          {asset.filename}
        </p>
        <p className="mt-0.5 text-[10px] font-medium text-ink-muted">
          {asset.width > 0 ? `${asset.width} × ${asset.height}` : "Video"}
        </p>
        {previewLoading ? <p className="mt-0.5 truncate text-[10px] font-semibold text-accent-500">Memuat pratinjau...</p> : null}
        {asset.videoPreviewStatus === "error" ? <p className="mt-0.5 truncate text-[10px] font-semibold text-amber-500" title={asset.videoPreviewError}>Pratinjau gagal</p> : null}
      </td>
      <td className="max-w-[290px] px-2 py-3.5">
        <p className={`truncate text-[12px] leading-snug ${metadata?.title ? "font-semibold text-ink" : "italic text-ink-muted"}`}>
          {metadata?.title || (isLoading ? loadingLabel : "Belum ada metadata")}
        </p>
        {isLoading ? (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-accent-700">
            <LoaderCircle size={11} className="animate-spin" />
            {loadingLabel}
          </p>
        ) : metadata?.warnings.length ? (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-700">
            <AlertCircle size={12} />
            {metadata.warnings.length} hal perlu dicek
          </p>
        ) : null}
      </td>
      <td className="px-2 py-3.5">
        <span className="rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-[10px] font-extrabold text-accent-700">
          {metadata ? `${metadata.keywords.length} keyword` : "—"}
        </span>
      </td>
      <td className="px-2 py-3.5 text-[11px] text-ink-secondary">
        {metadata ? (
          <>
            <span className="block truncate font-semibold text-ink">{categoryName(metadata.category)}</span>
            <span className="mt-0.5 block text-[10px] text-ink-muted">Category {metadata.category}</span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-2 py-3.5">
        {metadata ? (
          <div>
            <span
              className={`text-[15px] font-extrabold ${
                metadata.qualityScore >= 90 ? "text-emerald-600" : metadata.qualityScore >= 70 ? "text-amber-600" : "text-accent-700"
              }`}
            >
              {metadata.qualityScore}
            </span>
            <span className="mt-0.5 block text-[10px] font-medium text-ink-muted">{metadataLabel(metadata.qualityScore)}</span>
          </div>
        ) : (
          "—"
        )}
      </td>
      <td className="px-2 py-3.5">
        <div className="flex items-center justify-center gap-1">
          <button
            className="invisible rounded-lg p-1.5 text-ink-muted hover:bg-accent-100 hover:text-accent-800 group-hover:visible transition"
            aria-label={`Hapus ${asset.filename}`}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(asset.id);
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function TableEmpty({ onDrop, onChoose, isAddingAssets }: { onDrop: (event: React.DragEvent<HTMLDivElement>) => void; onChoose: (mediaType: AssetMediaType) => void; isAddingAssets: boolean }) {
  return (
    <div className="flex h-full items-center justify-center bg-surface-sunken/40" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      <div className="max-w-[410px] rounded-2xl border border-dashed border-accent-200 bg-surface px-8 py-8 text-center shadow-panel">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-600 shadow-sm">
          <Images size={22} />
        </div>
        <h2 className="mt-4 text-[17px] font-extrabold text-ink">Tambah gambar atau video</h2>
        <p className="mt-2 text-[12px] leading-6 text-ink-muted">
          Pilih salah satu tipe aset atau tarik file sejenis ke sini.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-left">
          <div className="rounded-xl border border-line bg-surface-sunken/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-ink"><FileImage size={15} className="text-accent-600" /> Gambar</div>
            <p className="mt-1 text-[10px] leading-4 text-ink-muted">JPG, PNG, WebP, SVG, EPS</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-sunken/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-ink"><Video size={15} className="text-accent-600" /> Video</div>
            <p className="mt-1 text-[10px] leading-4 text-ink-muted">MP4, MOV, WebM, M4V</p>
          </div>
        </div>
        <div className="mt-5 flex justify-center gap-2">
          <button className="app-button app-button-primary h-9 px-4 text-[11px]" disabled={isAddingAssets} onClick={() => onChoose("image")}><FileImage size={14} /> Pilih gambar</button>
          <button className="app-button h-9 px-4 text-[11px]" disabled={isAddingAssets} onClick={() => onChoose("video")}><Video size={14} /> Pilih video</button>
        </div>
      </div>
    </div>
  );
}
