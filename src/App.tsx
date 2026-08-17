import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Circle, CloudOff, Download, FileWarning, LoaderCircle } from "lucide-react";

import { NoticeStack } from "./components/common/NoticeStack";
import { GuideModal } from "./components/common/GuideModal";
import { SplashScreen } from "./components/common/SplashScreen";
import { LicenseGate } from "./components/common/LicenseGate";
import { Inspector } from "./components/metadata/Inspector";
import { MetadataTable } from "./components/metadata/MetadataTable";
import { StagedResearchPage } from "./components/metadata/StagedResearchPage";
import { TopBar, type AppViewMode } from "./components/layout/TopBar";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { ThemeSheet } from "./components/settings/ThemeSheet";
import { useAppStore } from "./stores/appStore";
import { cancelActiveGeneration, runGeneration } from "./services/generation";
import { activateLicense, deleteApiKey, exportCsvFile, getLicenseStatus, inspectAssets, isTauri, scanFolder, setApiKey, testApiKey, chooseFolder, chooseImages, chooseCsvOutput } from "./services/tauri";
import { readApiKey, removeApiKey, saveApiKey } from "./services/secretStore";
import { readSettings, writeSettings } from "./services/preferences";
import { aggregatePopulationKeywords, analyzeAdobePopulation, analyzeInitialCandidate, calculatePopulationRanking, cancelPopulationAnalysis, populationResearchForAsset, searchAdobePopulation } from "./services/population";
import { loadPopulationState, saveInitialCandidate, savePopulationResearch } from "./services/populationStore";
import { formatTokenCount, isTokenBudgetExhausted, readDailyUsage, remainingTokenBudget, writeDailyUsage } from "./services/usage";
import { emptyMetadata, qualityScore, validateMetadata } from "./utils/metadata";
import { serializeAdobeCsv } from "./utils/csv";
import type { AdobePopulationAssetType, AdobePopulationResearch, AdobePopulationSample, AdobePopulationSort, ApiStatus, CsvExportRequest, LicenseStatus, MetadataMode, StockAsset, StockMetadata } from "./types";
import { calculatePopulationConfidence, normalizeKeyword, scorePopulationTitle, selectAutomatedPopulationTitle, selectFinalPopulationKeywords, selectPopulationTitle, validatePopulationQuery } from "./utils/population";

const MAX_POPULATION_KEYWORDS = 35;

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
  const initialCandidates = useAppStore((state) => state.initialCandidates);
  const populationResearch = useAppStore((state) => state.populationResearch);
  const { addAssets, removeAsset, clearCompleted, clearAll, patchAsset, setSettings, setSelectedAssetId, toggleSelectedAsset, selectAll, clearSelection, setApiKeyConfigured, setApiKeyVerified, setDailyUsage, addNotice, dismissNotice, setAssetStatus, setInitialCandidates, setInitialCandidate, setPopulationResearch, recordGeminiError, clearGeminiError } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [isAddingAssets, setIsAddingAssets] = useState(false);
  const [exportIssues, setExportIssues] = useState<string[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeView, setActiveView] = useState<AppViewMode>("standard");
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

  useEffect(() => {
    void loadPopulationState()
      .then(({ initialCandidates: storedCandidates, research: storedResearch }) => {
        setInitialCandidates(storedCandidates);
        Object.values(storedResearch).forEach((research) => setPopulationResearch(research));
      })
      .catch(() => addNotice("warning", "Research tersimpan belum bisa dibaca."));
  }, [addNotice, setInitialCandidates, setPopulationResearch]);

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
  const selectedInitialCandidate = selectedAssetId ? initialCandidates[selectedAssetId] : undefined;
  const selectedPopulationResearch = selectedAssetId ? populationResearch[selectedAssetId] : undefined;
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

  const saveResearchState = (research: AdobePopulationResearch) => {
    setPopulationResearch(research);
    void savePopulationResearch(research).catch(() => addNotice("warning", "Research tersimpan lokal, tetapi belum bisa ditulis ke Store."));
  };

  const patchResearchState = (assetId: string, patch: Partial<AdobePopulationResearch>, candidate = useAppStore.getState().initialCandidates[assetId]) => {
    const existing = useAppStore.getState().populationResearch[assetId] ?? (candidate ? populationResearchForAsset(assetId, candidate) : emptyPopulationResearch(assetId));
    const next = { ...existing, ...patch };
    saveResearchState(next);
    return next;
  };

  const handleAnalyzeInitial = async () => {
    const asset = selectedAssetId ? useAppStore.getState().assets.find((item) => item.id === selectedAssetId) : undefined;
    if (!asset) return;
    if (!apiKeyVerified || offline) { addNotice("warning", "Verifikasi API key dan koneksi internet diperlukan untuk analisis Research."); return; }
    if (isTokenBudgetExhausted(settings, useAppStore.getState().dailyUsage)) {
      addNotice("warning", "Budget token harian lokal sudah habis. Naikkan budget atau set 0 untuk menonaktifkan pembatas.");
      return;
    }
    patchResearchState(asset.id, { status: "initializing", stale: false, warnings: [] });
    try {
      const initialResponse = await analyzeInitialCandidate({
        assetId: asset.id,
        imagePath: asset.path,
        model: settings.modelPreset === "custom" ? settings.customModel : settings.model,
      });
      const candidate = initialResponse.candidate;
      useAppStore.getState().recordGeminiUsage(initialResponse.usage);
      void writeDailyUsage(useAppStore.getState().dailyUsage);
      setInitialCandidate(candidate);
      await saveInitialCandidate(candidate);
      const currentMetadata = asset.metadata ?? emptyMetadata(asset, settings.metadataMode);
      const title = candidate.initialTitle.trim();
      const titleDraft = { ...currentMetadata, assetId: asset.id, title };
      const titleValidation = validateMetadata(asset.filename, titleDraft);
      updateMetadata(asset.id, {
        ...titleDraft,
        keywords: titleValidation.normalizedKeywords,
        warnings: titleValidation.warnings,
        qualityScore: qualityScore(
          { ...titleDraft, keywords: titleValidation.normalizedKeywords },
          titleValidation,
        ),
      });
      const research = {
        ...populationResearchForAsset(asset.id, candidate),
        selectedTitleSource: "initial" as const,
        selectedTitle: title,
      };
      setPopulationResearch(research);
      await savePopulationResearch(research);
      addNotice("success", `${asset.filename}: kandidat awal tersimpan dan judul utama otomatis diterapkan. Review query sebelum research Adobe.`);
    } catch (error) {
      recordGeminiError(error);
      void writeDailyUsage(useAppStore.getState().dailyUsage);
      patchResearchState(asset.id, { status: "failed", warnings: [populationWarning(error instanceof Error ? error.message : String(error), "initial-analysis")] });
      addNotice("error", `Kandidat awal gagal: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleResearchPopulation = async () => {
    const state = useAppStore.getState();
    const asset = selectedAssetId ? state.assets.find((item) => item.id === selectedAssetId) : undefined;
    const candidate = selectedAssetId ? state.initialCandidates[selectedAssetId] : undefined;
    if (!asset || !candidate) return;
    const existing = state.populationResearch[asset.id] ?? populationResearchForAsset(asset.id, candidate);
    const query = existing.query?.trim() || candidate.searchQuery;
    const locale = existing.locale?.trim() || "id";
    const assetType = existing.assetType ?? "vector";
    const sort = existing.sort ?? "relevance";
    const sampleLimit = existing.sampleLimit ?? 1;
    if (!validatePopulationQuery(query)) { addNotice("warning", "Search query harus berisi 1-3 kata Inggris."); return; }
    if (offline) { addNotice("warning", "Koneksi internet diperlukan untuk mengambil sample Adobe Stock."); return; }
    patchResearchState(asset.id, {
      status: "searching",
      stale: false,
      query,
      locale,
      assetType,
      sort,
      sampleLimit,
      samples: [],
      creationResults: undefined,
      keywordAggregation: [],
      recommendationTitleFromPopulation: undefined,
      titleScore: undefined,
      selectedTitleScore: undefined,
      automaticTitleSelection: undefined,
      recommendedFocusKeywords: undefined,
      selectedTitleSource: null,
      selectedTitle: undefined,
      selectedKeywords: [],
      warnings: [],
    }, candidate);
    try {
      const request = { assetId: asset.id, query, locale, assetType, sort, limit: sampleLimit };
      const relevance = await searchAdobePopulation(request);
      const creation = await searchAdobePopulation({ ...request, sort: "creation" });
      const rawSamples: AdobePopulationSample[] = relevance.results.map((result) => {
        const hasKeywords = Boolean(result.keywords && result.keywords.length > 0);
        return {
          sampleRank: result.rank,
          url: result.url,
          assetId: result.assetId,
          searchTitle: result.searchTitle,
          title: result.title ?? result.searchTitle,
          keywords: result.keywords ?? [],
          category: result.category,
          contributor: result.contributor,
          assetType: result.assetType,
          creationDate: result.creationDate,
          dateConfidence: result.creationDate ? 100 : 0,
          sourceCohort: "relevance",
          rawKeywords: [...(result.keywords ?? [])],
          normalizedKeywords: (result.keywords ?? []).map(normalizeKeyword),
          metadataStatus: hasKeywords ? ("extracted" as const) : ("unavailable" as const),
        };
      });
      if (!rawSamples.length) {
        throw new Error("Adobe Stock tidak mengembalikan sample untuk query ini.");
      }
      const samples = await calculatePopulationRanking(rawSamples, creation.results);
      const warnings = [...relevance.warnings, ...creation.warnings].map((message, index) => populationWarning(message, `adobe-${index}`));
      patchResearchState(asset.id, {
        status: samples.length > 0 ? "extracted" : "review",
        stale: false,
        searchUrl: relevance.searchUrl,
        samples,
        creationResults: creation.results,
        availableCohorts: creation.results.length ? ["relevance", "freshness"] : ["relevance"],
        keywordAggregation: [],
        recommendationTitleFromPopulation: undefined,
        titleScore: undefined,
        selectedTitleScore: undefined,
        automaticTitleSelection: undefined,
        recommendedFocusKeywords: undefined,
        selectedTitleSource: null,
        selectedTitle: undefined,
        selectedKeywords: [],
        warnings,
      }, candidate);
      addNotice("success", `${asset.filename}: ${samples.length} sample Adobe Stock beserta metadata detail berhasil diambil!`);
    } catch (error) {
      patchResearchState(asset.id, { status: "failed", warnings: [populationWarning(error instanceof Error ? error.message : String(error), "population-search")] }, candidate);
      addNotice("error", `Pencarian Adobe Stock gagal: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleAnalyzePopulation = async () => {
    const state = useAppStore.getState();
    const asset = selectedAssetId ? state.assets.find((item) => item.id === selectedAssetId) : undefined;
    const candidate = selectedAssetId ? state.initialCandidates[selectedAssetId] : undefined;
    if (!asset || !candidate) return;
    const existing = state.populationResearch[asset.id] ?? populationResearchForAsset(asset.id, candidate);
    if (!existing.samples.length) {
      addNotice("warning", "Ambil hasil pencarian Adobe Stock terlebih dahulu.");
      return;
    }
    if (!apiKeyVerified || offline) { addNotice("warning", "Verifikasi API key Gemini dan koneksi internet diperlukan untuk langkah berikutnya."); return; }
    if (isTokenBudgetExhausted(settings, useAppStore.getState().dailyUsage)) {
      addNotice("warning", "Budget token harian lokal sudah habis. Naikkan budget atau set 0 untuk menonaktifkan pembatas.");
      return;
    }
    const query = existing.query?.trim() || candidate.searchQuery;
    const locale = existing.locale?.trim() || "id";
    const assetType = existing.assetType ?? "vector";
    const sort = existing.sort ?? "relevance";
    patchResearchState(asset.id, { status: "analyzing", stale: false }, candidate);
    try {
      const analysis = await analyzeAdobePopulation({
        assetId: asset.id,
        imagePath: asset.path,
        model: settings.modelPreset === "custom" ? settings.customModel : settings.model,
        initialCandidate: candidate,
        samples: existing.samples,
        assetType,
        sort,
        locale,
      });
      const rankedSamples = await calculatePopulationRanking(existing.samples, existing.creationResults ?? []);
      const keywordAggregation = await aggregatePopulationKeywords(rankedSamples, candidate.visualFacts);
      const currentMetadata = asset.metadata ?? emptyMetadata(asset, settings.metadataMode);
      const automaticTitleSelection = selectAutomatedPopulationTitle(
        candidate,
        analysis.recommendationTitleFromPopulation,
        rankedSamples,
        keywordAggregation,
        currentMetadata.title,
      );
      const automaticKeywords = selectFinalPopulationKeywords(
        keywordAggregation,
        automaticTitleSelection.title,
        MAX_POPULATION_KEYWORDS,
      );
      const confidence = calculatePopulationConfidence(
        rankedSamples,
        keywordAggregation,
        automaticTitleSelection.title,
      );
      const titleScore = scorePopulationTitle(
        analysis.recommendationTitleFromPopulation,
        candidate,
        rankedSamples,
        keywordAggregation,
      );
      const existingKeywordSet = new Set(
        currentMetadata.keywords.map((keyword) => keyword.toLowerCase()),
      );
      const mergedKeywords = [
        ...currentMetadata.keywords,
        ...automaticKeywords
          .map((keyword) => keyword.keyword)
          .filter((keyword) => !existingKeywordSet.has(keyword.toLowerCase())),
      ];
      const keywordDraft = { ...currentMetadata, assetId: asset.id, title: automaticTitleSelection.title, keywords: mergedKeywords };
      const keywordValidation = validateMetadata(
        asset.filename,
        keywordDraft,
        MAX_POPULATION_KEYWORDS,
      );
      const automaticallyAppliedKeywords = keywordValidation.normalizedKeywords.filter(
        (keyword) => !existingKeywordSet.has(keyword.toLowerCase()),
      );
      const automaticKeywordSet = new Set(
        automaticKeywords.map((keyword) => keyword.normalizedKeyword),
      );
      const appliedPopulationKeywords = keywordValidation.normalizedKeywords
        .filter((keyword) => automaticKeywordSet.has(keyword.toLowerCase()));
      updateMetadata(asset.id, {
        ...keywordDraft,
        keywords: keywordValidation.normalizedKeywords,
        warnings: keywordValidation.warnings,
        qualityScore: qualityScore(
          { ...keywordDraft, keywords: keywordValidation.normalizedKeywords },
          keywordValidation,
        ),
      });
      const readyResearch: AdobePopulationResearch = {
        ...existing,
        assetId: asset.id,
        status: "ready",
        stale: false,
        query,
        locale,
        assetType,
        sort,
        samples: rankedSamples,
        keywordAggregation,
        recommendationTitleFromPopulation: analysis.recommendationTitleFromPopulation,
        titleScore,
        selectedTitleScore: automaticTitleSelection.score,
        automaticTitleSelection,
        recommendedFocusKeywords: analysis.recommendedFocusKeywords,
        selectedTitleSource: automaticTitleSelection.source,
        selectedTitle: automaticTitleSelection.title,
        selectedKeywords: appliedPopulationKeywords,
        confidenceScore: confidence.score,
        confidenceLabel: confidence.label,
        extractionCoverage: confidence.extractionCoverage,
        engineVersion: "research-pro-v3",
        availableCohorts: existing.availableCohorts?.length
          ? existing.availableCohorts
          : ["relevance"],
        warnings: [
          ...existing.warnings,
          ...(confidence.label === "limited"
            ? [populationWarning("Confidence terbatas: gunakan minimal 20 sample untuk validasi populasi yang lebih kuat.", "confidence-limited")]
            : []),
          ...(confidence.label === "insufficient"
            ? [populationWarning("Sample metadata terlalu sedikit untuk rekomendasi komersial yang stabil.", "confidence-insufficient")]
            : []),
          ...titleScore.warnings.map((message, index) => populationWarning(message, `title-score-${index}`)),
          ...automaticTitleSelection.score.warnings.map((message, index) => populationWarning(message, `selected-title-score-${index}`)),
        ],
      };
      useAppStore.getState().recordGeminiUsage(analysis.usage);
      void writeDailyUsage(useAppStore.getState().dailyUsage);
      saveResearchState(readyResearch);
      addNotice(
        "success",
        `${asset.filename}: population research selesai; judul otomatis memilih ${automaticTitleSelection.source}, ${automaticallyAppliedKeywords.length} keyword population otomatis diterapkan.`,
      );
    } catch (error) {
      recordGeminiError(error);
      void writeDailyUsage(useAppStore.getState().dailyUsage);
      patchResearchState(asset.id, { status: "failed", warnings: [...existing.warnings, populationWarning(error instanceof Error ? error.message : String(error), "population-analysis")] }, candidate);
      addNotice("error", `Population research gagal: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleCancelPopulationResearch = () => {
    if (!selectedAssetId) return;
    void cancelPopulationAnalysis(selectedAssetId).catch((error) => addNotice("warning", `Pembatalan Research gagal: ${error instanceof Error ? error.message : String(error)}`));
  };

  const handlePopulationConfigChange = (patch: { query?: string; locale?: string; assetType?: AdobePopulationAssetType; sort?: AdobePopulationSort; sampleLimit?: number }) => {
    if (!selectedAssetId) return;
    const current = useAppStore.getState().populationResearch[selectedAssetId] ?? (selectedInitialCandidate ? populationResearchForAsset(selectedAssetId, selectedInitialCandidate) : emptyPopulationResearch(selectedAssetId));
    patchResearchState(selectedAssetId, { ...patch, stale: true, status: current.status === "ready" || current.status === "review" ? "idle" : current.status });
  };

  const handleChoosePopulationTitle = (source: "initial" | "population" | "custom") => {
    if (!selectedAsset || !selectedInitialCandidate || !selectedPopulationResearch) return;
    const current = selectedAsset.metadata ?? emptyMetadata(selectedAsset, settings.metadataMode);
    const title = selectPopulationTitle(source, selectedInitialCandidate, selectedPopulationResearch, current.title);
    const draft = { ...current, title, assetId: selectedAsset.id };
    const validation = validateMetadata(selectedAsset.filename, draft);
    updateMetadata(selectedAsset.id, { ...draft, keywords: validation.normalizedKeywords, warnings: validation.warnings, qualityScore: qualityScore({ ...draft, keywords: validation.normalizedKeywords }, validation) });
    patchResearchState(selectedAsset.id, {
      selectedTitleSource: source,
      selectedTitle: title,
      selectedTitleScore: scorePopulationTitle(title, selectedInitialCandidate, selectedPopulationResearch.samples, selectedPopulationResearch.keywordAggregation),
    });
  };

  const handleTogglePopulationKeyword = (keyword: string) => {
    if (!selectedAssetId) return;
    const current = useAppStore.getState().populationResearch[selectedAssetId];
    if (!current) return;
    const selectedKeywords = current.selectedKeywords.includes(keyword) ? current.selectedKeywords.filter((value) => value !== keyword) : [...current.selectedKeywords, keyword];
    patchResearchState(selectedAssetId, { selectedKeywords });
  };

  const handleApplyPopulationKeywords = () => {
    if (!selectedAsset || !selectedPopulationResearch) return;
    const current = selectedAsset.metadata ?? emptyMetadata(selectedAsset, settings.metadataMode);
    const recommended = selectedPopulationResearch.keywordAggregation.filter((keyword) => selectedPopulationResearch.selectedKeywords.includes(keyword.normalizedKeyword)).map((keyword) => keyword.keyword);
    const nextKeywords = [...current.keywords, ...recommended.filter((keyword) => !current.keywords.some((value) => value.toLowerCase() === keyword.toLowerCase()))];
    const draft = { ...current, assetId: selectedAsset.id, keywords: nextKeywords };
    const validation = validateMetadata(
      selectedAsset.filename,
      draft,
      MAX_POPULATION_KEYWORDS,
    );
    updateMetadata(selectedAsset.id, { ...draft, keywords: validation.normalizedKeywords, warnings: validation.warnings, qualityScore: qualityScore({ ...draft, keywords: validation.normalizedKeywords }, validation) });
    addNotice("success", `${recommended.length} keyword population yang didukung gambar ditambahkan.`);
  };
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
  const bulkSetContentSource = (contentSource: StockMetadata["contentSource"]) => bulkEdit((metadata) => ({ ...metadata, contentSource }));
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
    if (!result.connected) {
      recordGeminiError(result.message ?? "Gemini menolak API key ini.");
      void writeDailyUsage(useAppStore.getState().dailyUsage);
      throw new Error(result.message ?? "Gemini menolak API key ini.");
    }
    clearGeminiError();
    void writeDailyUsage(useAppStore.getState().dailyUsage);
  };
  const removeKey = async () => { await removeApiKey(); await deleteApiKey(); setApiKeyConfigured(false); setApiKeyVerified(false); };
  const testKey = async (value: string): Promise<ApiStatus> => {
    try {
      const result = await testApiKey(value || undefined);
      setApiKeyVerified(result.connected);
      if (!result.connected) {
        recordGeminiError(result.message ?? "Koneksi Gemini gagal.");
        void writeDailyUsage(useAppStore.getState().dailyUsage);
      }
      if (result.connected) {
        clearGeminiError();
        void writeDailyUsage(useAppStore.getState().dailyUsage);
      }
      if (result.connected && value.trim()) await setApiKey(value);
      return result;
    } catch (error) {
      recordGeminiError(error);
      void writeDailyUsage(useAppStore.getState().dailyUsage);
      throw error;
    }
  };

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
        activeView={activeView}
        onViewChange={setActiveView}
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

      {activeView === "standard" ? (
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
            onSetContentSource={bulkSetContentSource}
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
      ) : (
        <main className="flex min-h-0 flex-1 bg-surface-muted p-4">
          <StagedResearchPage
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAssetId}
            candidate={selectedInitialCandidate}
            research={selectedPopulationResearch}
            canUseGemini={apiKeyVerified && !offline}
            canSearch={!offline}
            onAnalyzeInitial={() => void handleAnalyzeInitial()}
            onResearch={() => void handleResearchPopulation()}
            onAnalyzePopulation={() => void handleAnalyzePopulation()}
            onCancel={handleCancelPopulationResearch}
            onConfigChange={handlePopulationConfigChange}
            onChooseTitle={handleChoosePopulationTitle}
            onToggleKeyword={handleTogglePopulationKeyword}
            onApplyKeywords={handleApplyPopulationKeywords}
          />
        </main>
      )}

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
          {remainingTokenBudget(dailyUsage, settings.dailyTokenBudget) !== null ? ` · sisa ${formatTokenCount(remainingTokenBudget(dailyUsage, settings.dailyTokenBudget) ?? 0)}` : ""}
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

function emptyPopulationResearch(assetId: string): AdobePopulationResearch {
  return {
    assetId,
    status: "idle",
    stale: false,
    samples: [],
    keywordAggregation: [],
    selectedTitleSource: null,
    selectedKeywords: [],
    warnings: [],
  };
}

function populationWarning(message: string, code: string) {
  return { code, message, severity: "warning" as const };
}
