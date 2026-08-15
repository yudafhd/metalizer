import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Circle, CloudOff, Download, FileWarning, LoaderCircle } from "lucide-react";

import { NoticeStack } from "./components/common/NoticeStack";
import { GuideModal } from "./components/common/GuideModal";
import { SplashScreen } from "./components/common/SplashScreen";
import { LicenseGate } from "./components/common/LicenseGate";
import { Inspector } from "./components/metadata/Inspector";
import { MetadataTable } from "./components/metadata/MetadataTable";
import { TopBar } from "./components/layout/TopBar";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { ThemeSheet } from "./components/settings/ThemeSheet";
import { useAppStore } from "./stores/appStore";
import { cancelActiveGeneration, runGeneration } from "./services/generation";
import { activateLicense, deleteApiKey, exportCsvFile, getLicenseStatus, inspectAssets, isTauri, scanFolder, setApiKey, testApiKey, chooseFolder, chooseImages, chooseCsvOutput } from "./services/tauri";
import { readApiKey, removeApiKey, saveApiKey } from "./services/secretStore";
import { readSettings, writeSettings } from "./services/preferences";
import { formatTokenCount, readDailyUsage } from "./services/usage";
import { emptyMetadata, qualityScore, validateMetadata } from "./utils/metadata";
import { serializeAdobeCsv } from "./utils/csv";
import type { ApiStatus, CsvExportRequest, LicenseStatus, MetadataMode, StockAsset, StockMetadata } from "./types";

export default function App() {
  const assets = useAppStore((state) => state.assets);
  const jobs = useAppStore((state) => state.jobs);
  const settings = useAppStore((state) => state.settings);
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const selectedAssetIds = useAppStore((state) => state.selectedAssetIds);
  const isGenerating = useAppStore((state) => state.isGenerating);
  const apiKeyConfigured = useAppStore((state) => state.apiKeyConfigured);
  const apiKeyVerified = useAppStore((state) => state.apiKeyVerified);
  const dailyUsage = useAppStore((state) => state.dailyUsage);
  const progress = useAppStore((state) => state.progress);
  const notices = useAppStore((state) => state.notices);
  const { addAssets, removeAsset, clearCompleted, clearAll, patchAsset, setSettings, setSelectedAssetId, toggleSelectedAsset, selectAll, clearSelection, setApiKeyConfigured, setApiKeyVerified, setDailyUsage, addNotice, dismissNotice, setAssetStatus } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [isAddingAssets, setIsAddingAssets] = useState(false);
  const [exportIssues, setExportIssues] = useState<string[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>();
  const [licenseBusy, setLicenseBusy] = useState(true);
  const [licenseError, setLicenseError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowSplash(false), 2_500);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const loadedSettings = await readSettings(settings).catch(() => settings);
        setSettings(loadedSettings);
        const loadedUsage = await readDailyUsage().catch(() => undefined);
        if (loadedUsage) setDailyUsage(loadedUsage);
        const key = await readApiKey().catch(() => null);
        if (key) {
          await setApiKey(key).catch(() => undefined);
          setApiKeyConfigured(true);
          if (navigator.onLine) {
            const verification = await testApiKey(key).catch(() => undefined);
            setApiKeyVerified(Boolean(verification?.connected));
          }
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

  useEffect(() => { void getLicenseStatus().then(setLicenseStatus).catch((error) => setLicenseError(error instanceof Error ? error.message : String(error))).finally(() => setLicenseBusy(false)); }, []);

  useEffect(() => { if (settingsHydrated) void writeSettings(settings); }, [settings, settingsHydrated]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim().split(/\s+/).map(Number);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta && themeColor.length === 3 && themeColor.every(Number.isFinite)) themeMeta.setAttribute("content", `rgb(${themeColor.join(", ")})`);
  }, [settings.theme]);

  useEffect(() => {
    const refreshDailyUsage = () => { void readDailyUsage().then(setDailyUsage); };
    const interval = window.setInterval(refreshDailyUsage, 60_000);
    return () => window.clearInterval(interval);
  }, [setDailyUsage]);

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === selectedAssetId), [assets, selectedAssetId]);
  const counts = useMemo(() => ({ complete: assets.filter((asset) => asset.status === "completed").length, processing: assets.filter((asset) => asset.status === "processing" || asset.status === "preparing").length, queued: assets.filter((asset) => asset.status === "queued").length, failed: assets.filter((asset) => asset.status === "failed").length }), [assets]);

  const addPaths = useCallback(async (paths: string[]) => {
    if (!paths.length) return;
    try {
      const existing = new Set(useAppStore.getState().assets.map((asset) => asset.path));
      const freshPaths = paths.filter((path) => !existing.has(path));
      if (!freshPaths.length) { addNotice("info", "Gambar itu sudah ada di antrean."); return; }
      const descriptors = await inspectAssets(freshPaths);
      const nextAssets: StockAsset[] = descriptors.map((descriptor) => ({ ...descriptor, status: "queued" }));
      addAssets(nextAssets);
      if (descriptors.length < freshPaths.length) addNotice("warning", `${freshPaths.length - descriptors.length} file yang tidak didukung atau rusak dilewati.`);
      if (nextAssets.length && !selectedAssetId) setSelectedAssetId(nextAssets[0]?.id);
    } catch (error) {
      addNotice("error", error instanceof Error ? error.message : String(error));
    }
  }, [addAssets, addNotice, selectedAssetId, setSelectedAssetId]);

  const addImages = async () => {
    if (!isTauri) { fileInput.current?.click(); return; }
    setIsAddingAssets(true);
    try {
      await addPaths(await chooseImages());
    } finally {
      setIsAddingAssets(false);
    }
  };
  const addFolder = async () => {
    if (!isTauri) { addNotice("info", "Pilih folder hanya tersedia di aplikasi desktop."); return; }
    setIsAddingAssets(true);
    try {
      const folder = await chooseFolder();
      if (!folder) return;
      const result = await scanFolder(folder);
      if (!result.paths.length) {
        addNotice("warning", "Folder ini belum berisi gambar JPG, PNG, WebP, atau SVG yang bisa dipakai.");
        return;
      }
      await addPaths(result.paths);
      if (result.rejectedCount) addNotice("warning", `${result.rejectedCount} file yang tidak didukung dilewati.`);
    } catch (error) {
      addNotice("error", error instanceof Error ? error.message : "Folder tidak bisa dibaca.");
    } finally {
      setIsAddingAssets(false);
    }
  };
  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const paths = Array.from(event.dataTransfer.files).map((file) => (file as File & { path?: string }).path).filter((path): path is string => Boolean(path));
    if (!paths.length) { addNotice("warning", "Gunakan Tambah gambar di aplikasi desktop untuk memasukkan file lokal."); return; }
    setIsAddingAssets(true);
    try {
      await addPaths(paths);
    } finally {
      setIsAddingAssets(false);
    }
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

  const handleActivateLicense = async (email: string, code: string) => {
    setLicenseBusy(true); setLicenseError(undefined);
    try { setLicenseStatus(await activateLicense(code, email)); } catch (error) { setLicenseError(error instanceof Error ? error.message : String(error)); } finally { setLicenseBusy(false); }
  };

  const saveKey = async (value: string) => {
    await saveApiKey(value);
    await setApiKey(value);
    setApiKeyConfigured(true);
    const result = await testApiKey(value);
    setApiKeyVerified(result.connected);
    if (!result.connected) throw new Error(result.message ?? "Gemini menolak API key ini.");
  };
  const removeKey = async () => { await removeApiKey(); await deleteApiKey(); setApiKeyConfigured(false); setApiKeyVerified(false); };
  const testKey = async (value: string): Promise<ApiStatus> => { const result = await testApiKey(value || undefined); setApiKeyVerified(result.connected); if (result.connected && value.trim()) await setApiKey(value); return result; };

  const startExport = () => {
    const issues = assets.flatMap((asset) => {
      if (!asset.metadata) return [`${asset.filename}: metadata belum ada`];
      if (asset.status !== "completed") return [`${asset.filename}: aset berstatus ${asset.status} dan tidak akan ikut di-export`];
      const validation = validateMetadata(asset.filename, asset.metadata);
      return validation.warnings.filter((warning) => warning.severity === "error").map((warning) => `${asset.filename}: ${warning.message}`);
    });
    if (issues.length) { setExportIssues(issues); return; }
    void performExport();
  };
  const performExport = async () => {
    const rows = assets.filter((asset) => asset.metadata && asset.status === "completed").map((asset) => ({ filename: asset.filename, title: asset.metadata?.title ?? "", keywords: asset.metadata?.keywords ?? [], category: asset.metadata?.category ?? 8, releases: "" }));
    if (!rows.length) { addNotice("warning", "Belum ada metadata yang selesai untuk di-export."); return; }
    setExporting(true);
    try {
      if (isTauri) {
        const outputPath = await chooseCsvOutput();
        if (!outputPath) return;
        const request: CsvExportRequest = { outputPath, rows, includeReleases: settings.includeReleases };
        const result = await exportCsvFile(request);
        addNotice("success", `${result.rowCount} baris berhasil di-export ke ${result.files.length} file CSV.`);
      } else {
        downloadCsv(rows, settings.includeReleases);
        addNotice("success", `${rows.length} baris berhasil di-export.`);
      }
    } catch (error) { addNotice("error", error instanceof Error ? error.message : String(error)); } finally { setExporting(false); setExportIssues(null); }
  };

  if (showSplash) return <SplashScreen />;
  if (!licenseStatus?.valid) return <LicenseGate status={licenseStatus} busy={licenseBusy} error={licenseError} onActivate={handleActivateLicense} />;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-muted" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <TopBar
        assetCount={assets.length}
        canGenerate={assets.length > 0 && apiKeyVerified && !offline}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        onCancel={handleCancel}
        onOpenThemePicker={() => setThemeSheetOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        metadataMode={settings.metadataMode}
        onModeChange={(metadataMode: MetadataMode) => setSettings({ ...settings, metadataMode })}
        onExport={startExport}
        canExport={assets.length > 0}
      />
      {!apiKeyConfigured ? (
        <div className="flex h-10 shrink-0 items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 text-[11px] font-semibold text-ink">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span>
            <b className="font-extrabold text-amber-500">Gemini API key belum ada.</b> Atur dulu di Pengaturan sebelum Generate.
          </span>
          <button
            className="font-extrabold text-accent-600 underline decoration-accent-500/50 underline-offset-2 hover:text-accent-500 transition-colors"
            onClick={() => setSettingsOpen(true)}
          >
            Atur sekarang
          </button>
        </div>
      ) : !apiKeyVerified ? (
        <div className="flex h-10 shrink-0 items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 text-[11px] font-semibold text-ink">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span>
            <b className="font-extrabold text-amber-500">Koneksi Gemini belum dicek.</b> Tes API key yang tersimpan di Pengaturan sebelum Generate.
          </span>
          <button
            className="font-extrabold text-accent-600 underline decoration-accent-500/50 underline-offset-2 hover:text-accent-500 transition-colors"
            onClick={() => setSettingsOpen(true)}
          >
            Buka Pengaturan
          </button>
        </div>
      ) : offline ? (
        <div className="flex h-10 shrink-0 items-center justify-center gap-2 border-b border-accent-500/20 bg-accent-500/10 text-[11px] font-medium text-ink">
          <CloudOff size={14} className="text-accent-500 shrink-0" />
          <span>Offline — metadata yang ada tetap bisa diedit dan di-export; Generate AI ditunda.</span>
        </div>
      ) : null}

      {isGenerating ? <ProgressBar progress={progress} jobs={jobs.length} /> : null}

      <main className="flex min-h-0 flex-1 gap-4 bg-surface-muted p-4">
        <MetadataTable
          assets={assets}
          selectedAssetId={selectedAssetId}
          selectedAssetIds={selectedAssetIds}
          isGenerating={isGenerating}
          isAddingAssets={isAddingAssets}
          additionalPrompt={settings.additionalPrompt}
          onAdditionalPromptChange={(additionalPrompt) => setSettings({ ...settings, additionalPrompt })}
          onSelect={setSelectedAssetId}
          onToggle={toggleSelectedAsset}
          onRemove={removeAsset}
          onClearCompleted={clearCompleted}
          onClearAll={clearAll}
          onRetryFailed={() => { void runGeneration({ onlyFailed: true }); }}
          onDrop={handleDrop}
          onChoose={addImages}
          onAddFolder={addFolder}
          onSelectAll={() => selectedAssetIds.length === assets.length ? clearSelection() : selectAll()}
          onSetCategory={bulkSetCategory}
          onAddKeyword={bulkAddKeyword}
          onRemoveKeyword={bulkRemoveKeyword}
          onRegenerate={bulkRegenerate}
        />
        {selectedAsset ? (
          <Inspector
            asset={selectedAsset}
            mode={settings.metadataMode}
            onClose={() => setSelectedAssetId(undefined)}
            onUpdate={updateMetadata}
            onRegenerate={regenerate}
            onUndo={undoRegenerate}
          />
        ) : null}
      </main>

      <footer className="flex h-[40px] shrink-0 items-center justify-between border-t border-line bg-surface px-6 text-[11px] font-semibold text-ink-muted">
        <div className="flex items-center gap-4">
          <span><b className="font-extrabold text-ink">{assets.length}</b> aset</span>
          <span><b className="font-extrabold text-emerald-600">{counts.complete}</b> selesai</span>
          <span><b className="font-extrabold text-accent-600">{counts.processing}</b> diproses</span>
          <span><b className="font-extrabold text-ink-secondary">{counts.queued}</b> antre</span>
          {counts.failed ? <span><b className="font-extrabold text-amber-600">{counts.failed}</b> gagal</span> : null}
        </div>
        <span className="hidden lg:inline">
          Hari ini: <b className="text-accent-700">{dailyUsage.requests} request</b> · {formatTokenCount(dailyUsage.totalTokens)} token
        </span>
      </footer>

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.svg"
        onChange={(event) => {
          const paths = Array.from(event.target.files ?? []).map((file) => (file as File & { path?: string }).path).filter((path): path is string => Boolean(path));
          setIsAddingAssets(true);
          void addPaths(paths).finally(() => setIsAddingAssets(false));
          event.target.value = "";
        }}
      />
      {themeSheetOpen ? (
        <ThemeSheet
          currentTheme={settings.theme}
          onSelectTheme={(theme) => setSettings({ ...settings, theme })}
          onClose={() => setThemeSheetOpen(false)}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          apiKeyConfigured={apiKeyConfigured}
          apiKeyVerified={apiKeyVerified}
          dailyUsage={dailyUsage}
          offline={offline}
          onSettingsChange={setSettings}
          onSaveApiKey={saveKey}
          onDeleteApiKey={removeKey}
          onTestApiKey={testKey}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {guideOpen ? <GuideModal onClose={() => setGuideOpen(false)} /> : null}
      {exportIssues ? (
        <ExportReviewDialog
          issues={exportIssues}
          exporting={exporting}
          onCancel={() => setExportIssues(null)}
          onExport={() => void performExport()}
        />
      ) : null}
      <NoticeStack notices={notices} onDismiss={dismissNotice} />
    </div>
  );
}

function ProgressBar({ progress, jobs }: { progress: { total: number; completed: number; processing: number; queuedBatches: number; currentBatch?: string }; jobs: number }) {
  const percent = progress.total ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0;
  return (
    <div className="flex h-[46px] shrink-0 items-center gap-4 border-b border-line bg-accent-50/70 px-6">
      <LoaderCircle size={15} className="animate-spin text-accent-600" />
      <div className="w-[220px]">
        <div className="flex justify-between text-[10px] font-extrabold text-ink">
          <span>Generate metadata</span>
          <span>{progress.completed}/{progress.total}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-accent-200">
          <div className="h-full rounded-full bg-accent-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <span className="text-[10px] font-semibold text-ink-muted">
        Batch {progress.currentBatch ?? "—"} · {progress.processing} sedang diproses · {progress.queuedBatches}/{jobs} antrean aktif
      </span>
      <span className="ml-auto text-[10px] font-extrabold text-accent-700">{percent}%</span>
    </div>
  );
}

function ExportReviewDialog({ issues, exporting, onCancel, onExport }: { issues: string[]; exporting: boolean; onCancel: () => void; onExport: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/35 backdrop-blur-sm">
      <div className="w-[490px] rounded-2xl border border-line bg-surface p-6 shadow-modal">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
            <FileWarning size={20} />
          </div>

          <div>
            <h2 className="text-[16px] font-extrabold text-ink">Beberapa aset perlu dicek</h2>
            <p className="mt-1 text-[12px] leading-5 text-ink-secondary">
              Ada masalah yang bisa membuat baris CSV kurang lengkap. Perbaiki dulu, atau tetap export metadata yang sudah siap.
            </p>
          </div>
        </div>
        <div className="mt-4 max-h-40 overflow-y-auto rounded-xl border border-line bg-surface-sunken p-3.5">
          {issues.slice(0, 12).map((issue) => (
            <p key={issue} className="mb-1.5 flex items-start gap-1.5 text-[11px] leading-5 text-ink">
              <Circle size={6} fill="currentColor" className="mt-1.5 shrink-0 text-accent-600" />
              {issue}
            </p>
          ))}
          {issues.length > 12 ? (
            <p className="text-[11px] font-medium text-ink-muted">+ {issues.length - 12} lainnya</p>
          ) : null}
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <button className="app-button" onClick={onCancel}>
            Cek dulu
          </button>
          <button className="app-button app-button-primary" disabled={exporting} onClick={onExport}>
            {exporting ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />} Tetap export
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadCsv(rows: { filename: string; title: string; keywords: string[]; category: number; releases?: string }[], includeReleases: boolean) {
  const csv = serializeAdobeCsv(rows, includeReleases);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "adobe-stock-metadata.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
