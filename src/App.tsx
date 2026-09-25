import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CloudOff, LoaderCircle } from "lucide-react";
import packageJson from "../package.json";

import { NoticeStack } from "./components/common/NoticeStack";
import { GuideModal } from "./components/common/GuideModal";
import { SplashScreen } from "./components/common/SplashScreen";
import { ExportDialog } from "./components/common/ExportDialog";
import { DiscoverSheet } from "./components/common/DiscoverSheet";
import { LicenseGate } from "./components/common/LicenseGate";
import { Inspector } from "./components/metadata/Inspector";
import { MetadataTable } from "./components/metadata/MetadataTable";
import { TopBar } from "./components/layout/TopBar";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { ThemeSheet } from "./components/settings/ThemeSheet";
import { useAppStore } from "./stores/appStore";
import { cancelActiveGeneration, runGeneration } from "./services/generation";
import { activateLicense, checkForAppUpdate, cleanupTempFile, deleteApiKey, exportCsvFile, getLicenseStatus, inspectAssets, isTauri, saveTempImage, scanFolder, setApiKey, testApiKey, chooseFolder, chooseAssets, chooseCsvOutput } from "./services/tauri";
import { readApiKey, removeApiKey, saveApiKey } from "./services/secretStore";
import { readSettings, writeSettings } from "./services/preferences";
import { fetchDiscover, readSeenDiscoverIds, writeSeenDiscoverIds } from "./services/discover";
import type { DiscoverItem } from "./services/discover";
import { formatTokenCount, readDailyUsage } from "./services/usage";
import { emptyMetadata, qualityScore, validateMetadata } from "./utils/metadata";
import { extractVideoMetadataAndStoryboard, isVideoMime, isVideoPath } from "./services/video";
import { serializeCsv } from "./utils/csv";
import { EXPORT_PLATFORMS, suggestShutterstockCategory } from "./constants/exportPlatforms";
import type { ApiStatus, AssetMediaType, CsvExportPlatform, CsvExportRequest, CsvExportRow, LicenseStatus, MetadataMode, StockAsset, StockMetadata } from "./types";

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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportIssues, setExportIssues] = useState<string[]>([]);
  const [exportPlatform, setExportPlatform] = useState<CsvExportPlatform>("adobe");
  const [shutterstockCategories, setShutterstockCategories] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>();
  const [licenseBusy, setLicenseBusy] = useState(true);
  const [licenseError, setLicenseError] = useState<string>();
  const [updateAvailable, setUpdateAvailable] = useState<string>();
  const [updateBusy, setUpdateBusy] = useState(false);
  const updateCheckPromiseRef = useRef<ReturnType<typeof checkForAppUpdate> | null>(null);
  const announcedUpdateVersionRef = useRef<string | undefined>(undefined);
  const installedUpdateVersionRef = useRef<string | undefined>(undefined);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverItems, setDiscoverItems] = useState<DiscoverItem[]>([]);
  const [discoverSheetUnreadIds, setDiscoverSheetUnreadIds] = useState<Set<string>>(() => new Set());
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string>();
  const [seenDiscoverIds, setSeenDiscoverIds] = useState<string[]>(readSeenDiscoverIds);
  const [discoverRefreshTick, setDiscoverRefreshTick] = useState(0);
  const seenDiscoverRef = useRef(new Set(seenDiscoverIds));
  const announcedDiscoverRef = useRef(new Set<string>());
  const discoverOpenRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileInputMediaType = useRef<AssetMediaType>("image");
  const importInProgressRef = useRef(false);

  const discoverUnreadIds = new Set(discoverItems.filter((item) => !seenDiscoverIds.includes(item.id)).map((item) => item.id));

  useEffect(() => {
    if (!licenseStatus?.valid) return;
    const interval = window.setInterval(() => setDiscoverRefreshTick((tick) => tick + 1), 2 * 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [licenseStatus?.valid]);

  useEffect(() => {
    if (!licenseStatus?.valid) return;
    let active = true;
    setDiscoverLoading(true);
    void fetchDiscover()
      .then((items) => {
        if (!active) return;
        setDiscoverItems(items);
        setDiscoverError(undefined);
        const newItems = items.filter((item) => !seenDiscoverRef.current.has(item.id) && !announcedDiscoverRef.current.has(item.id));
        newItems.forEach((item) => announcedDiscoverRef.current.add(item.id));
        if (newItems.length && discoverOpenRef.current) {
          setDiscoverSheetUnreadIds((current) => new Set([...current, ...newItems.map((item) => item.id)]));
        }
        if (newItems.length && !discoverOpenRef.current) {
          addNotice("info", `${newItems.length} kabar baru dari Mahes. Buka Discover untuk melihatnya.`);
        }
      })
      .catch((error) => { if (active) setDiscoverError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (active) setDiscoverLoading(false); });
    return () => { active = false; };
  }, [licenseStatus?.valid, discoverRefreshTick, addNotice]);

  useEffect(() => {
    if (!discoverOpen || !discoverItems.length) return;
    const ids = new Set(seenDiscoverRef.current);
    discoverItems.forEach((item) => ids.add(item.id));
    if (ids.size === seenDiscoverRef.current.size) return;
    seenDiscoverRef.current = ids;
    const updated = [...ids];
    setSeenDiscoverIds(updated);
    writeSeenDiscoverIds(updated);
  }, [discoverOpen, discoverItems]);

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

  const checkUpdateOnce = useCallback(async () => {
    if (updateCheckPromiseRef.current) return updateCheckPromiseRef.current;
    const request = checkForAppUpdate();
    updateCheckPromiseRef.current = request;
    try {
      return await request;
    } finally {
      if (updateCheckPromiseRef.current === request) updateCheckPromiseRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!licenseStatus?.valid || !isTauri) return;
    const checkUpdate = () => {
      void checkUpdateOnce().then((update) => {
        if (update && update.version === installedUpdateVersionRef.current) return;
        setUpdateAvailable(update?.version);
        if (update && announcedUpdateVersionRef.current !== update.version) {
          announcedUpdateVersionRef.current = update.version;
          addNotice("info", `Update Metalizer v${update.version} tersedia. Klik ikon update untuk menginstal.`);
        }
      }).catch(() => undefined);
    };
    checkUpdate();
    const interval = window.setInterval(checkUpdate, 2 * 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [licenseStatus?.valid, checkUpdateOnce, addNotice]);

  const checkUpdates = async () => {
    if (!isTauri) { addNotice("info", "Update aplikasi hanya tersedia di aplikasi desktop."); return; }
    setUpdateBusy(true);
    try {
      const update = await checkUpdateOnce();
      if (!update || update.version === installedUpdateVersionRef.current) { setUpdateAvailable(undefined); addNotice("success", "Metalizer sudah menggunakan versi terbaru."); return; }
      setUpdateAvailable(update.version);
      announcedUpdateVersionRef.current = update.version;
      if (!window.confirm(`Update Metalizer v${update.version} tersedia. Install sekarang?`)) return;
      await update.downloadAndInstall();
      installedUpdateVersionRef.current = update.version;
      setUpdateAvailable(undefined);
      addNotice("success", "Update berhasil diinstal. Tutup lalu buka ulang Metalizer.");
    } catch (error) {
      addNotice("error", `Gagal memeriksa update: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setUpdateBusy(false);
    }
  };

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

  const addPaths = useCallback(async (paths: string[], requestedType?: AssetMediaType) => {
    if (!paths.length) return;
    try {
      const existing = new Set(useAppStore.getState().assets.map((asset) => asset.path));
      const freshPaths = paths.filter((path) => !existing.has(path));
      if (!freshPaths.length) { addNotice("info", "Aset tersebut sudah ada di antrean."); return; }
      const descriptors = await inspectAssets(freshPaths);
      const incomingTypes = new Set<AssetMediaType>(descriptors.map((descriptor) => isVideoMime(descriptor.mimeType) || isVideoPath(descriptor.path) ? "video" : "image"));
      if (incomingTypes.size > 1) { addNotice("warning", "Pilih hanya gambar atau hanya video dalam satu impor."); return; }
      if (!incomingTypes.size) { addNotice("warning", "Tidak ada aset yang didukung untuk diimpor."); return; }
      const incomingType = [...incomingTypes][0];
      if (requestedType && incomingType !== requestedType) { addNotice("warning", `Pilihan ini hanya menerima ${requestedType === "video" ? "video" : "gambar"}.`); return; }
      const workspaceTypes = new Set<AssetMediaType>(useAppStore.getState().assets.map((asset) => asset.mediaType ?? (isVideoPath(asset.path) ? "video" : "image")));
      if (workspaceTypes.size > 1 || (workspaceTypes.size && !workspaceTypes.has(incomingType))) {
        addNotice("warning", "Workspace hanya dapat berisi gambar atau video. Bersihkan aset yang ada sebelum mengganti tipe.");
        return;
      }
      const nextAssets: StockAsset[] = descriptors.map((descriptor) => {
        const isVideo = isVideoMime(descriptor.mimeType) || isVideoPath(descriptor.path);
        return {
          ...descriptor,
          status: "queued",
          mediaType: isVideo ? "video" : "image",
          videoPreviewStatus: isVideo ? "loading" : undefined,
        };
      });
      addAssets(nextAssets);
      if (descriptors.length < freshPaths.length) addNotice("warning", `${freshPaths.length - descriptors.length} file yang tidak didukung atau rusak dilewati.`);
      if (nextAssets.length && !selectedAssetId) setSelectedAssetId(nextAssets[0]?.id);

      // Asynchronously extract video metadata and thumbnail for newly added videos
      nextAssets
        .filter((asset) => asset.mediaType === "video")
        .forEach(async (videoAsset) => {
          try {
            const meta = await extractVideoMetadataAndStoryboard(videoAsset.path);
            const current = useAppStore.getState().assets.find((candidate) => candidate.id === videoAsset.id);
            if (!current || current.videoPreviewStatus === "ready" || current.videoFrameTimes?.length) return;
            useAppStore.getState().patchAsset(videoAsset.id, {
              width: meta.width,
              height: meta.height,
              duration: meta.duration,
              previewUrl: meta.thumbnailUrl,
              videoFramePreviews: meta.framePreviews,
              videoPreviewStatus: "ready",
              videoPreviewError: undefined,
            });
          } catch (err) {
            console.error(`Gagal memuat video preview untuk ${videoAsset.filename}:`, err);
            const message = err instanceof Error ? err.message : String(err);
            if (useAppStore.getState().assets.some((candidate) => candidate.id === videoAsset.id && candidate.videoPreviewStatus === "loading")) {
              useAppStore.getState().patchAsset(videoAsset.id, { videoPreviewStatus: "error", videoPreviewError: message });
              useAppStore.getState().addNotice("warning", `${videoAsset.filename}: pratinjau video gagal dibuat. ${message}`);
            }
          }
        });
    } catch (error) {
      addNotice("error", error instanceof Error ? error.message : String(error));
    }
  }, [addAssets, addNotice, selectedAssetId, setSelectedAssetId]);

  const importAssets = async (task: () => Promise<void>) => {
    if (importInProgressRef.current) return;
    importInProgressRef.current = true;
    setIsAddingAssets(true);
    try { await task(); }
    finally { importInProgressRef.current = false; setIsAddingAssets(false); }
  };
  const addFiles = async (mediaType: AssetMediaType) => {
    if (!isTauri) {
      fileInputMediaType.current = mediaType;
      if (fileInput.current) fileInput.current.accept = mediaType === "video" ? ".mp4,.mov,.webm,.m4v" : ".jpg,.jpeg,.png,.webp,.svg,.eps";
      fileInput.current?.click();
      return;
    }
    await importAssets(async () => addPaths(await chooseAssets(mediaType), mediaType));
  };
  const addFolder = async (mediaType: AssetMediaType) => {
    if (!isTauri) { addNotice("info", "Pilih folder hanya tersedia di aplikasi desktop."); return; }
    await importAssets(async () => {
      try {
        const folder = await chooseFolder();
        if (!folder) return;
        const result = await scanFolder(folder);
        const matchingPaths = result.paths.filter((path) => (isVideoPath(path) ? "video" : "image") === mediaType);
        if (!matchingPaths.length) {
          addNotice("warning", `Folder ini belum berisi ${mediaType === "video" ? "video" : "gambar"} yang didukung.`);
          return;
        }
        await addPaths(matchingPaths, mediaType);
        const otherCount = result.paths.length - matchingPaths.length;
        if (otherCount) addNotice("info", `${otherCount} aset tipe lain dilewati.`);
        if (result.rejectedCount) addNotice("warning", `${result.rejectedCount} file yang tidak didukung dilewati.`);
      } catch (error) {
        addNotice("error", error instanceof Error ? error.message : "Folder tidak bisa dibaca.");
      }
    });
  };
  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const paths = Array.from(event.dataTransfer.files).map((file) => (file as File & { path?: string }).path).filter((path): path is string => Boolean(path));
    if (!paths.length) { addNotice("warning", "Gunakan tombol Gambar atau Video di aplikasi desktop untuk memasukkan file lokal."); return; }
    await importAssets(async () => addPaths(paths));
  };

  const updateMetadata = (assetId: string, metadata: StockMetadata) => patchAsset(assetId, { metadata, status: "completed", error: undefined });
  const saveVideoFrames = async (assetId: string, times: number[], coverTime: number) => {
    const current = useAppStore.getState();
    const asset = current.assets.find((candidate) => candidate.id === assetId);
    if (!asset) throw new Error("Video tidak lagi tersedia di workspace.");
    if (current.isGenerating) throw new Error("Tunggu proses generate selesai sebelum mengganti titik gambar.");
    const meta = await extractVideoMetadataAndStoryboard(asset.path, times, coverTime);
    const storyboardPath = await saveTempImage(meta.storyboardDataUrl, `storyboard-${asset.id}-${Date.now()}.jpg`);
    current.patchAsset(assetId, {
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
      previewUrl: meta.thumbnailUrl,
      storyboardPath,
      videoFrameTimes: [...times],
      videoCoverTime: coverTime,
      videoFramePreviews: meta.framePreviews,
      videoPreviewStatus: "ready",
      videoPreviewError: undefined,
    });
    if (asset.storyboardPath) void cleanupTempFile(asset.storyboardPath).catch(console.error);
    current.addNotice("success", `${times.length} gambar video disimpan. Gambar utama dan storyboard sudah diperbarui.`);
  };
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
    setExportIssues(issues);
    setExportOpen(true);
  };
  const performExport = async () => {
    const rows: CsvExportRow[] = assets.filter((asset) => asset.metadata && asset.status === "completed" && (exportPlatform !== "freepik" || asset.mediaType !== "video")).map((asset) => ({
      filename: asset.filename, title: asset.metadata!.title, keywords: asset.metadata!.keywords,
      category: asset.metadata!.category, releases: "",
      shutterstockCategory: shutterstockCategories[asset.id] ?? suggestShutterstockCategory(asset.metadata!.category),
    }));
    if (!rows.length) { addNotice("warning", "Belum ada metadata yang selesai untuk di-export."); return; }
    setExporting(true);
    let completed = false;
    try {
      if (isTauri) {
        const filename = EXPORT_PLATFORMS.find((item) => item.id === exportPlatform)!.filename;
        const outputPath = await chooseCsvOutput(filename);
        if (!outputPath) return;
        const request: CsvExportRequest = { outputPath, rows, includeReleases: settings.includeReleases, platform: exportPlatform };
        const result = await exportCsvFile(request);
        addNotice("success", `${result.rowCount} baris berhasil di-export ke ${result.files.length} file CSV.`);
        completed = true;
      } else {
        downloadCsv(rows, exportPlatform, settings.includeReleases);
        addNotice("success", `${rows.length} baris berhasil di-export.`);
        completed = true;
      }
    } catch (error) { addNotice("error", error instanceof Error ? error.message : String(error)); } finally { setExporting(false); if (completed) setExportOpen(false); }
  };

  if (showSplash) return <SplashScreen />;
  if (!licenseStatus?.valid) return <LicenseGate status={licenseStatus} busy={licenseBusy} error={licenseError} onActivate={handleActivateLicense} />;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-muted" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <TopBar
        appVersion={packageJson.version}
        assetCount={assets.length}
        canGenerate={assets.length > 0 && apiKeyVerified && !offline}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        onCancel={handleCancel}
        onOpenThemePicker={() => setThemeSheetOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenDiscover={() => { setDiscoverSheetUnreadIds(new Set(discoverUnreadIds)); discoverOpenRef.current = true; setDiscoverOpen(true); }}
        discoverUnreadCount={discoverUnreadIds.size}
        updateAvailable={updateAvailable}
        onOpenUpdates={() => setSettingsOpen(true)}
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
          onChoose={addFiles}
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
            onSaveVideoFrames={saveVideoFrames}
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
        accept=".jpg,.jpeg,.png,.webp,.svg,.eps"
        onChange={(event) => {
          const paths = Array.from(event.target.files ?? []).map((file) => (file as File & { path?: string }).path).filter((path): path is string => Boolean(path));
          void importAssets(async () => addPaths(paths, fileInputMediaType.current));
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
          updateBusy={updateBusy}
          updateAvailable={updateAvailable}
          onCheckForUpdates={checkUpdates}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {guideOpen ? <GuideModal onClose={() => setGuideOpen(false)} /> : null}
      {discoverOpen ? (
        <DiscoverSheet
          items={discoverItems}
          unreadIds={discoverSheetUnreadIds}
          loading={discoverLoading}
          error={discoverError}
          onRefresh={() => setDiscoverRefreshTick((tick) => tick + 1)}
          onClose={() => { discoverOpenRef.current = false; setDiscoverOpen(false); }}
        />
      ) : null}
      {exportOpen ? (
        <ExportDialog
          assets={assets}
          issues={exportIssues}
          platform={exportPlatform}
          categories={shutterstockCategories}
          exporting={exporting}
          onPlatformChange={setExportPlatform}
          onCategoryChange={(assetId, category) => setShutterstockCategories((current) => ({ ...current, [assetId]: category }))}
          onClose={() => setExportOpen(false)}
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

function downloadCsv(rows: CsvExportRow[], platform: CsvExportPlatform, includeReleases: boolean) {
  const csv = serializeCsv(rows, platform, includeReleases);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = EXPORT_PLATFORMS.find((item) => item.id === platform)!.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
