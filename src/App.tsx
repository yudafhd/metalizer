import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CloudOff, Download, FileWarning, LoaderCircle } from "lucide-react";

import { AssetQueue } from "./components/assets/AssetQueue";
import { NoticeStack } from "./components/common/NoticeStack";
import { Inspector } from "./components/metadata/Inspector";
import { MetadataTable } from "./components/metadata/MetadataTable";
import { TopBar } from "./components/layout/TopBar";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { useAppStore } from "./stores/appStore";
import { cancelActiveGeneration, runGeneration } from "./services/generation";
import { deleteApiKey, exportCsvFile, inspectAssets, isTauri, scanFolder, setApiKey, testApiKey, chooseFolder, chooseImages, chooseCsvOutput } from "./services/tauri";
import { readApiKey, removeApiKey, saveApiKey } from "./services/secretStore";
import { readSettings, writeSettings } from "./services/preferences";
import { emptyMetadata, qualityScore, validateMetadata } from "./utils/metadata";
import { serializeAdobeCsv } from "./utils/csv";
import type { ApiStatus, CsvExportRequest, MetadataMode, StockAsset, StockMetadata } from "./types";

export default function App() {
  const assets = useAppStore((state) => state.assets);
  const jobs = useAppStore((state) => state.jobs);
  const settings = useAppStore((state) => state.settings);
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const selectedAssetIds = useAppStore((state) => state.selectedAssetIds);
  const isGenerating = useAppStore((state) => state.isGenerating);
  const apiKeyConfigured = useAppStore((state) => state.apiKeyConfigured);
  const apiKeyVerified = useAppStore((state) => state.apiKeyVerified);
  const progress = useAppStore((state) => state.progress);
  const notices = useAppStore((state) => state.notices);
  const { addAssets, removeAsset, clearCompleted, clearAll, patchAsset, setSettings, setSelectedAssetId, toggleSelectedAsset, selectAll, clearSelection, setApiKeyConfigured, setApiKeyVerified, addNotice, dismissNotice, setAssetStatus } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [exportIssues, setExportIssues] = useState<string[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const loadedSettings = await readSettings(settings).catch(() => settings);
        setSettings(loadedSettings);
        const key = await readApiKey().catch(() => null);
        if (key) {
          await setApiKey(key).catch(() => undefined);
          setApiKeyConfigured(true);
        }
      } finally {
        setSettingsHydrated(true);
      }
    })();
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []); // settings are intentionally loaded once at startup

  useEffect(() => { if (settingsHydrated) void writeSettings(settings); }, [settings, settingsHydrated]);

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === selectedAssetId), [assets, selectedAssetId]);
  const counts = useMemo(() => ({ complete: assets.filter((asset) => asset.status === "completed").length, processing: assets.filter((asset) => asset.status === "processing" || asset.status === "preparing").length, queued: assets.filter((asset) => asset.status === "queued").length, failed: assets.filter((asset) => asset.status === "failed").length }), [assets]);

  const addPaths = useCallback(async (paths: string[]) => {
    if (!paths.length) return;
    try {
      const existing = new Set(useAppStore.getState().assets.map((asset) => asset.path));
      const freshPaths = paths.filter((path) => !existing.has(path));
      if (!freshPaths.length) { addNotice("info", "Those images are already in the queue."); return; }
      const descriptors = await inspectAssets(freshPaths);
      const nextAssets: StockAsset[] = descriptors.map((descriptor) => ({ ...descriptor, status: "queued" }));
      addAssets(nextAssets);
      if (descriptors.length < freshPaths.length) addNotice("warning", `${freshPaths.length - descriptors.length} unsupported or invalid files were skipped.`);
      if (nextAssets.length && !selectedAssetId) setSelectedAssetId(nextAssets[0]?.id);
    } catch (error) {
      addNotice("error", error instanceof Error ? error.message : String(error));
    }
  }, [addAssets, addNotice, selectedAssetId, setSelectedAssetId]);

  const addImages = async () => {
    if (!isTauri) { fileInput.current?.click(); return; }
    await addPaths(await chooseImages());
  };
  const addFolder = async () => {
    if (!isTauri) { addNotice("info", "Folder selection is available in the desktop build."); return; }
    const folder = await chooseFolder();
    if (!folder) return;
    try { const result = await scanFolder(folder); await addPaths(result.paths); if (result.rejectedCount) addNotice("warning", `${result.rejectedCount} unsupported files were skipped.`); } catch (error) { addNotice("error", error instanceof Error ? error.message : String(error)); }
  };
  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const paths = Array.from(event.dataTransfer.files).map((file) => (file as File & { path?: string }).path).filter((path): path is string => Boolean(path));
    if (!paths.length) { addNotice("warning", "Use Choose images in the desktop app to import local files."); return; }
    await addPaths(paths);
  };

  const updateMetadata = (assetId: string, metadata: StockMetadata) => patchAsset(assetId, { metadata, status: "completed", error: undefined });
  const regenerate = (assetId: string, scope: "full" | "title" | "keywords") => { setAssetStatus(assetId, "queued"); setSelectedAssetId(assetId); void runGeneration({ assetIds: [assetId], scope }); };
  const undoRegenerate = (assetId: string) => { const asset = useAppStore.getState().assets.find((candidate) => candidate.id === assetId); if (asset?.previousMetadata) patchAsset(assetId, { metadata: asset.previousMetadata, previousMetadata: undefined, status: "completed", error: undefined }); };
  const bulkEdit = (transform: (metadata: StockMetadata) => StockMetadata) => {
    const currentAssets = useAppStore.getState().assets;
    selectedAssetIds.forEach((assetId) => {
      const asset = currentAssets.find((candidate) => candidate.id === assetId);
      if (!asset) return;
      const next = transform(asset.metadata ?? emptyMetadata(asset, settings.metadataMode));
      const validation = validateMetadata(asset.filename, next);
      patchAsset(asset.id, { metadata: { ...next, keywords: validation.normalizedKeywords, warnings: validation.warnings, qualityScore: qualityScore({ ...next, keywords: validation.normalizedKeywords }, validation) }, status: "completed" });
    });
  };
  const bulkSetCategory = (category: number) => bulkEdit((metadata) => ({ ...metadata, category }));
  const bulkAddKeyword = (keyword: string) => bulkEdit((metadata) => ({ ...metadata, keywords: [...metadata.keywords, keyword] }));
  const bulkRemoveKeyword = (keyword: string) => bulkEdit((metadata) => ({ ...metadata, keywords: metadata.keywords.filter((value) => value.toLowerCase() !== keyword.toLowerCase()) }));
  const bulkRegenerate = () => { selectedAssetIds.forEach((assetId) => setAssetStatus(assetId, "queued")); void runGeneration({ assetIds: selectedAssetIds, scope: "full" }); };
  const handleGenerate = () => { void runGeneration(); };
  const handleCancel = () => { void cancelActiveGeneration(); };

  const saveKey = async (value: string) => {
    await saveApiKey(value);
    await setApiKey(value);
    setApiKeyConfigured(true);
    const result = await testApiKey(value);
    setApiKeyVerified(result.connected);
    if (!result.connected) throw new Error(result.message ?? "Gemini rejected this API key.");
  };
  const removeKey = async () => { await removeApiKey(); await deleteApiKey(); setApiKeyConfigured(false); setApiKeyVerified(false); };
  const testKey = async (value: string): Promise<ApiStatus> => { const result = await testApiKey(value || undefined); setApiKeyVerified(result.connected); if (result.connected && value.trim()) await setApiKey(value); return result; };

  const startExport = () => {
    const issues = assets.flatMap((asset) => {
      if (!asset.metadata) return [`${asset.filename}: metadata is missing`];
      if (asset.status !== "completed") return [`${asset.filename}: asset is ${asset.status} and will be excluded`];
      const validation = validateMetadata(asset.filename, asset.metadata);
      return validation.warnings.filter((warning) => warning.severity === "error").map((warning) => `${asset.filename}: ${warning.message}`);
    });
    if (issues.length) { setExportIssues(issues); return; }
    void performExport();
  };
  const performExport = async () => {
    const rows = assets.filter((asset) => asset.metadata && asset.status === "completed").map((asset) => ({ filename: asset.filename, title: asset.metadata?.title ?? "", keywords: asset.metadata?.keywords ?? [], category: asset.metadata?.category ?? 8, releases: "" }));
    if (!rows.length) { addNotice("warning", "There is no complete metadata to export."); return; }
    setExporting(true);
    try {
      if (isTauri) {
        const outputPath = await chooseCsvOutput();
        if (!outputPath) return;
        const request: CsvExportRequest = { outputPath, rows, includeReleases: settings.includeReleases };
        const result = await exportCsvFile(request);
        addNotice("success", `Exported ${result.rowCount} rows to ${result.files.length} CSV file${result.files.length === 1 ? "" : "s"}.`);
      } else {
        downloadCsv(rows, settings.includeReleases);
        addNotice("success", `Exported ${rows.length} rows.`);
      }
    } catch (error) { addNotice("error", error instanceof Error ? error.message : String(error)); } finally { setExporting(false); setExportIssues(null); }
  };

  return <div className="flex h-screen flex-col overflow-hidden bg-[#f7f8f9]" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
    <TopBar settings={settings} assetCount={assets.length} canGenerate={assets.length > 0 && apiKeyVerified && !offline} isGenerating={isGenerating} onAddImages={addImages} onAddFolder={addFolder} onGenerate={handleGenerate} onCancel={handleCancel} onExport={startExport} onOpenSettings={() => setSettingsOpen(true)} onModeChange={(metadataMode: MetadataMode) => setSettings({ ...settings, metadataMode })} />
    {!apiKeyConfigured ? <div className="flex h-9 shrink-0 items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 text-[11px] text-amber-800"><AlertTriangle size={13} /><span><b>Gemini API key required.</b> Configure it in Settings before generating.</span><button className="font-bold underline" onClick={() => setSettingsOpen(true)}>Configure</button></div> : !apiKeyVerified ? <div className="flex h-9 shrink-0 items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 text-[11px] text-amber-800"><AlertTriangle size={13} /><span><b>Gemini connection not verified.</b> Test the saved key in Settings before generating.</span><button className="font-bold underline" onClick={() => setSettingsOpen(true)}>Open Settings</button></div> : offline ? <div className="flex h-9 shrink-0 items-center justify-center gap-2 border-b border-slate-200 bg-slate-100 text-[11px] text-slate-600"><CloudOff size={13} /><span>Offline — editing and CSV export remain available; AI generation is paused.</span></div> : null}
    {isGenerating ? <ProgressBar progress={progress} jobs={jobs.length} /> : null}
    <main className="flex min-h-0 flex-1"><AssetQueue assets={assets} selectedAssetId={selectedAssetId} selectedAssetIds={selectedAssetIds} isGenerating={isGenerating} onSelect={setSelectedAssetId} onToggle={toggleSelectedAsset} onRemove={removeAsset} onClearCompleted={clearCompleted} onClearAll={clearAll} onRetryFailed={() => { void runGeneration({ onlyFailed: true }); }} onDrop={handleDrop} onChoose={addImages} /><MetadataTable assets={assets} selectedAssetId={selectedAssetId} selectedAssetIds={selectedAssetIds} onSelect={setSelectedAssetId} onToggle={toggleSelectedAsset} onSelectAll={() => selectedAssetIds.length === assets.length ? clearSelection() : selectAll()} onSetCategory={bulkSetCategory} onAddKeyword={bulkAddKeyword} onRemoveKeyword={bulkRemoveKeyword} onRegenerate={bulkRegenerate} /><Inspector asset={selectedAsset} mode={settings.metadataMode} onClose={() => setSelectedAssetId(undefined)} onUpdate={updateMetadata} onRegenerate={regenerate} onUndo={undoRegenerate} /></main>
    <footer className="flex h-[42px] shrink-0 items-center justify-between border-t border-line bg-white px-6 text-[10px] text-slate-400"><div className="flex items-center gap-4"><span><b className="text-ink">{assets.length}</b> assets</span><span><b className="text-mint">{counts.complete}</b> complete</span><span><b className="text-accent">{counts.processing}</b> processing</span><span><b className="text-slate-500">{counts.queued}</b> queued</span>{counts.failed ? <span><b className="text-amber-600">{counts.failed}</b> failed</span> : null}</div><span>Gemini requests run locally through Rust · no cloud backend</span></footer>
    <input ref={fileInput} type="file" className="hidden" multiple accept=".jpg,.jpeg,.png,.webp" onChange={(event) => { const paths = Array.from(event.target.files ?? []).map((file) => (file as File & { path?: string }).path).filter((path): path is string => Boolean(path)); void addPaths(paths); event.target.value = ""; }} />
    {settingsOpen ? <SettingsPanel settings={settings} apiKeyConfigured={apiKeyConfigured} apiKeyVerified={apiKeyVerified} offline={offline} onSettingsChange={setSettings} onSaveApiKey={saveKey} onDeleteApiKey={removeKey} onTestApiKey={testKey} onClose={() => setSettingsOpen(false)} /> : null}
    {exportIssues ? <ExportReviewDialog issues={exportIssues} exporting={exporting} onCancel={() => setExportIssues(null)} onExport={() => void performExport()} /> : null}
    <NoticeStack notices={notices} onDismiss={dismissNotice} />
  </div>;
}

function ProgressBar({ progress, jobs }: { progress: { total: number; completed: number; processing: number; queuedBatches: number; currentBatch?: string }; jobs: number }) { const percent = progress.total ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0; return <div className="flex h-[43px] shrink-0 items-center gap-4 border-b border-line bg-white px-6"><LoaderCircle size={14} className="animate-spin text-accent" /><div className="w-[190px]"><div className="flex justify-between text-[10px] font-semibold text-ink"><span>Generating metadata</span><span>{progress.completed}/{progress.total}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} /></div></div><span className="text-[10px] text-slate-400">Batch {progress.currentBatch ?? "—"} · {progress.processing} processing · {progress.queuedBatches}/{jobs} active queue</span><span className="ml-auto text-[10px] font-bold text-accent">{percent}%</span></div>; }

function ExportReviewDialog({ issues, exporting, onCancel, onExport }: { issues: string[]; exporting: boolean; onCancel: () => void; onExport: () => void }) { return <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 backdrop-blur-[1px]"><div className="w-[470px] rounded-xl border border-line bg-white p-6 shadow-2xl"><div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600"><FileWarning size={18} /></div><div><h2 className="text-[14px] font-bold text-ink">Some assets need review</h2><p className="mt-1 text-[11px] leading-4 text-slate-500">Critical validation errors may produce an incomplete Adobe Stock row. You can fix them or export the remaining metadata anyway.</p></div></div><div className="mt-4 max-h-36 overflow-y-auto rounded-md bg-slatepanel p-3">{issues.slice(0, 12).map((issue) => <p key={issue} className="mb-1 text-[10px] leading-4 text-slate-600">• {issue}</p>)}{issues.length > 12 ? <p className="text-[10px] text-slate-400">+ {issues.length - 12} more</p> : null}</div><div className="mt-5 flex justify-end gap-2"><button className="app-button" onClick={onCancel}>Review</button><button className="app-button app-button-primary" disabled={exporting} onClick={onExport}>{exporting ? <LoaderCircle size={13} className="animate-spin" /> : <Download size={13} />} Export anyway</button></div></div></div>; }

function downloadCsv(rows: { filename: string; title: string; keywords: string[]; category: number; releases?: string }[], includeReleases: boolean) { const csv = serializeAdobeCsv(rows, includeReleases); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "adobe-stock-metadata.csv"; anchor.click(); URL.revokeObjectURL(url); }
