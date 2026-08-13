export type AssetStatus = "queued" | "preparing" | "processing" | "completed" | "failed";
export type MetadataMode = "strict" | "balanced" | "discovery";
export type ContentSource = "standard" | "generative-ai";

export interface MetadataWarning {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface StockMetadata {
  assetId: string;
  title: string;
  keywords: string[];
  category: number;
  qualityScore: number;
  warnings: MetadataWarning[];
  aiGenerated: boolean;
  metadataMode: MetadataMode;
  contentSource: ContentSource;
}

export interface StockAsset {
  id: string;
  filename: string;
  path: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  previewUrl?: string;
  batchId?: string;
  status: AssetStatus;
  metadata?: StockMetadata;
  previousMetadata?: StockMetadata;
  similarAssetGroupId?: string;
  error?: string;
}

export interface BatchJob {
  id: string;
  assetIds: string[];
  status: AssetStatus;
  attempt: number;
  error?: string;
}

export interface AppSettings {
  model: string;
  modelPreset: "balanced" | "fast" | "custom";
  customModel: string;
  batchSize: 1 | 2 | 3 | 4 | 5 | 6;
  concurrency: 1 | 2 | 3;
  metadataMode: MetadataMode;
  targetKeywords: number;
  contactSheetQuality: number;
  maxSheetSize: number;
  background: "neutral" | "white" | "gray";
  includeReleases: boolean;
  theme: "light" | "dark";
}

export interface GenerationProgress {
  total: number;
  completed: number;
  processing: number;
  queuedBatches: number;
  currentBatch?: string;
  cancelled: boolean;
}

export interface AssetDescriptor {
  id: string;
  filename: string;
  path: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  previewUrl?: string;
}

export interface ContactSheetAsset {
  panelId: string;
  path: string;
  filename: string;
}

export interface ContactSheetRequest {
  batchId: string;
  assets: ContactSheetAsset[];
  maxSheetSize: number;
  quality: number;
  background: string;
}

export interface ContactSheetResult {
  batchId: string;
  path: string;
  width: number;
  height: number;
  assets: ContactSheetAsset[];
}

export interface GeneratedMetadata {
  id: string;
  title: string;
  keywords: string[];
  category: number;
}

export interface GenerateMetadataRequest {
  batchId: string;
  contactSheetPath: string;
  expectedIds: string[];
  mapping: { id: string; filename: string }[];
  model: string;
  mode: string;
  targetKeywords: number;
  generationScope?: "full" | "title" | "keywords";
}

export interface MetadataGenerationResult {
  batchId: string;
  assets: GeneratedMetadata[];
  missingIds: string[];
  warnings: string[];
  attempts: number;
}

export interface ApiStatus {
  connected: boolean;
  status: "connected" | "invalid" | "rateLimited" | "failed";
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: MetadataWarning[];
  normalizedKeywords: string[];
}

export interface CsvExportRow {
  filename: string;
  title: string;
  keywords: string[];
  category: number;
  releases?: string;
}

export interface CsvExportRequest {
  outputPath: string;
  rows: CsvExportRow[];
  includeReleases: boolean;
}

export interface CsvExportResult {
  files: string[];
  rowCount: number;
}
