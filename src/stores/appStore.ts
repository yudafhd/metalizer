import { create } from "zustand";

import type { AppSettings, AssetStatus, BatchJob, GenerationProgress, StockAsset } from "../types";

export const DEFAULT_SETTINGS: AppSettings = {
  model: "gemini-2.5-flash",
  modelPreset: "balanced",
  customModel: "",
  batchSize: 6,
  concurrency: 2,
  metadataMode: "balanced",
  targetKeywords: 40,
  contactSheetQuality: 85,
  maxSheetSize: 2048,
  background: "neutral",
  includeReleases: false,
  theme: "light",
};

interface Notice {
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
  progress: GenerationProgress;
  notices: Notice[];
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
  setGenerating: (value: boolean) => void;
  setApiKeyConfigured: (value: boolean) => void;
  setApiKeyVerified: (value: boolean) => void;
  setProgress: (progress: GenerationProgress) => void;
  patchProgress: (patch: Partial<GenerationProgress>) => void;
  addNotice: (tone: Notice["tone"], message: string) => void;
  dismissNotice: (id: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  assets: [],
  jobs: [],
  settings: DEFAULT_SETTINGS,
  selectedAssetIds: [],
  selectedAssetId: undefined,
  isGenerating: false,
  apiKeyConfigured: false,
  apiKeyVerified: false,
  progress: { total: 0, completed: 0, processing: 0, queuedBatches: 0, cancelled: false },
  notices: [],
  setAssets: (assets) => set({ assets }),
  addAssets: (assets) => set((state) => ({ assets: [...state.assets, ...assets] })),
  removeAsset: (id) => set((state) => ({
    assets: state.assets.filter((asset) => asset.id !== id),
    selectedAssetIds: state.selectedAssetIds.filter((selectedId) => selectedId !== id),
    selectedAssetId: state.selectedAssetId === id ? undefined : state.selectedAssetId,
  })),
  clearCompleted: () => set((state) => ({ assets: state.assets.filter((asset) => asset.status !== "completed") })),
  clearAll: () => set({ assets: [], jobs: [], selectedAssetIds: [], selectedAssetId: undefined, progress: { total: 0, completed: 0, processing: 0, queuedBatches: 0, cancelled: false } }),
  patchAsset: (id, patch) => set((state) => ({ assets: state.assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset) })),
  setAssetStatus: (id, status, error) => set((state) => ({ assets: state.assets.map((asset) => asset.id === id ? { ...asset, status, error } : asset) })),
  setJobs: (jobs) => set({ jobs }),
  updateJob: (id, patch) => set((state) => ({ jobs: state.jobs.map((job) => job.id === id ? { ...job, ...patch } : job) })),
  setSettings: (settings) => set({ settings }),
  setSelectedAssetId: (id) => set({ selectedAssetId: id }),
  toggleSelectedAsset: (id) => set((state) => ({ selectedAssetIds: state.selectedAssetIds.includes(id) ? state.selectedAssetIds.filter((selectedId) => selectedId !== id) : [...state.selectedAssetIds, id] })),
  selectAll: () => set((state) => ({ selectedAssetIds: state.assets.map((asset) => asset.id) })),
  clearSelection: () => set({ selectedAssetIds: [] }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setApiKeyConfigured: (apiKeyConfigured) => set({ apiKeyConfigured }),
  setApiKeyVerified: (apiKeyVerified) => set({ apiKeyVerified }),
  setProgress: (progress) => set({ progress }),
  patchProgress: (patch) => set((state) => ({ progress: { ...state.progress, ...patch } })),
  addNotice: (tone, message) => set((state) => ({ notices: [...state.notices, { id: crypto.randomUUID(), tone, message }] })),
  dismissNotice: (id) => set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),
}));

export type { Notice };
