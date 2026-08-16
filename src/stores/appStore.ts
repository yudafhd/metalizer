import { create } from "zustand";

import { GEMINI_MODELS } from "../constants/models";
import type { AdobePopulationResearch, AppSettings, AssetStatus, BatchJob, DailyUsage, GenerationProgress, GeminiUsageMetadata, InitialCandidate, StockAsset } from "../types";
import { emptyDailyUsage, todayKey, usageToDailyDelta } from "../services/usage";

export const DEFAULT_SETTINGS: AppSettings = {
  model: GEMINI_MODELS.balanced,
  modelPreset: "balanced",
  customModel: "",
  batchSize: 6,
  concurrency: 2,
  metadataMode: "balanced",
  targetKeywords: 30,
  additionalPrompt: "",
  contactSheetQuality: 85,
  maxSheetSize: 2048,
  background: "neutral",
  includeReleases: false,
  theme: "nebula",
};

export interface Notice {
  id: string;
  tone: "info" | "success" | "warning" | "error";
  message: string;
}

interface AppStore {
  assets: StockAsset[];
  jobs: BatchJob[];
  settings: AppSettings;
  selectedAssetIds: string[];
  selectedAssetId?: string;
  isGenerating: boolean;
  apiKeyConfigured: boolean;
  apiKeyVerified: boolean;
  dailyUsage: DailyUsage;
  progress: GenerationProgress;
  notices: Notice[];
  initialCandidates: Record<string, InitialCandidate>;
  populationResearch: Record<string, AdobePopulationResearch>;
  setAssets: (assets: StockAsset[]) => void;
  addAssets: (assets: StockAsset[]) => void;
  removeAsset: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  patchAsset: (id: string, patch: Partial<StockAsset>) => void;
  setAssetStatus: (id: string, status: AssetStatus, error?: string) => void;
  setJobs: (jobs: BatchJob[]) => void;
  updateJob: (id: string, patch: Partial<BatchJob>) => void;
  setSettings: (settings: AppSettings) => void;
  setSelectedAssetId: (id?: string) => void;
  toggleSelectedAsset: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setGenerating: (isGenerating: boolean) => void;
  setApiKeyConfigured: (apiKeyConfigured: boolean) => void;
  setApiKeyVerified: (apiKeyVerified: boolean) => void;
  setDailyUsage: (dailyUsage: DailyUsage) => void;
  recordGeminiUsage: (usage?: GeminiUsageMetadata) => void;
  setProgress: (progress: GenerationProgress) => void;
  patchProgress: (patch: Partial<GenerationProgress>) => void;
  addNotice: (tone: Notice["tone"], message: string) => void;
  dismissNotice: (id: string) => void;
  setInitialCandidates: (candidates: Record<string, InitialCandidate>) => void;
  setInitialCandidate: (candidate: InitialCandidate) => void;
  setPopulationResearch: (research: AdobePopulationResearch) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  assets: [],
  jobs: [],
  settings: DEFAULT_SETTINGS,
  selectedAssetIds: [],
  isGenerating: false,
  apiKeyConfigured: false,
  apiKeyVerified: false,
  dailyUsage: emptyDailyUsage(todayKey()),
  progress: { total: 0, completed: 0, processing: 0, queuedBatches: 0, cancelled: false },
  notices: [],
  initialCandidates: {},
  populationResearch: {},

  setAssets: (assets) => set({ assets }),
  addAssets: (incoming) =>
    set((state) => {
      const existingPaths = new Set(state.assets.map((asset) => asset.path));
      const fresh = incoming.filter((asset) => !existingPaths.has(asset.path));
      return { assets: [...state.assets, ...fresh] };
    }),
  removeAsset: (id) =>
    set((state) => ({
      assets: state.assets.filter((asset) => asset.id !== id),
      selectedAssetIds: state.selectedAssetIds.filter((item) => item !== id),
      selectedAssetId: state.selectedAssetId === id ? undefined : state.selectedAssetId,
    })),
  clearCompleted: () =>
    set((state) => ({
      assets: state.assets.filter((asset) => asset.status !== "completed"),
      selectedAssetIds: [],
      selectedAssetId: state.selectedAssetId && state.assets.find((item) => item.id === state.selectedAssetId)?.status === "completed" ? undefined : state.selectedAssetId,
    })),
  clearAll: () => set({ assets: [], selectedAssetIds: [], selectedAssetId: undefined }),
  patchAsset: (id, patch) =>
    set((state) => ({
      assets: state.assets.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)),
    })),
  setAssetStatus: (id, status, error) =>
    set((state) => ({
      assets: state.assets.map((asset) => (asset.id === id ? { ...asset, status, error } : asset)),
    })),
  setJobs: (jobs) => set({ jobs }),
  updateJob: (id, patch) =>
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    })),
  setSettings: (settings) => set({ settings }),
  setSelectedAssetId: (selectedAssetId) => set({ selectedAssetId }),
  toggleSelectedAsset: (id) =>
    set((state) => ({
      selectedAssetIds: state.selectedAssetIds.includes(id)
        ? state.selectedAssetIds.filter((item) => item !== id)
        : [...state.selectedAssetIds, id],
    })),
  selectAll: () => set((state) => ({ selectedAssetIds: state.assets.map((asset) => asset.id) })),
  clearSelection: () => set({ selectedAssetIds: [] }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setApiKeyConfigured: (apiKeyConfigured) => set({ apiKeyConfigured }),
  setApiKeyVerified: (apiKeyVerified) => set({ apiKeyVerified }),
  setDailyUsage: (dailyUsage) => set({ dailyUsage }),
  recordGeminiUsage: (usage) =>
    set((state) => {
      const delta = usageToDailyDelta(usage);
      const nextUsage = {
        date: todayKey(),
        requests: state.dailyUsage.requests + delta.requests,
        promptTokens: state.dailyUsage.promptTokens + delta.promptTokens,
        outputTokens: state.dailyUsage.outputTokens + delta.outputTokens,
        totalTokens: state.dailyUsage.totalTokens + delta.totalTokens,
      };
      return { dailyUsage: nextUsage };
    }),
  setProgress: (progress) => set({ progress }),
  patchProgress: (patch) => set((state) => ({ progress: { ...state.progress, ...patch } })),
  addNotice: (tone, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({
      notices: [...state.notices, { id, tone, message }],
    }));
    window.setTimeout(() => {
      set((state) => ({
        notices: state.notices.filter((notice) => notice.id !== id),
      }));
    }, 2_000);
  },
  dismissNotice: (id) =>
    set((state) => ({
      notices: state.notices.filter((notice) => notice.id !== id),
    })),
  setInitialCandidates: (initialCandidates) => set({ initialCandidates }),
  setInitialCandidate: (candidate) => set((state) => ({ initialCandidates: { ...state.initialCandidates, [candidate.assetId]: candidate } })),
  setPopulationResearch: (research) => set((state) => ({ populationResearch: { ...state.populationResearch, [research.assetId]: research } })),
}));
