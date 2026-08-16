export type AssetStatus = "queued" | "preparing" | "processing" | "completed" | "failed";
export type MetadataMode = "strict" | "balanced" | "discovery";
export type ContentSource = "standard" | "generative-ai";
export type AppTheme =
  | "ocean"
  | "sage"
  | "lavender"
  | "sand"
  | "rose"
  | "eucalyptus"
  | "clay"
  | "graphite"
  | "sky"
  | "paper"
  | "obsidian"
  | "midnight"
  | "nord"
  | "forest"
  | "espresso"
  | "cyber"
  | "aurora"
  | "nebula"
  | "prism"
  | "solstice"
  | "arcane";



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
  modelPreset: "balanced" | "fast" | "population" | "populationPro" | "custom";
  customModel: string;
  batchSize: 1 | 2 | 3 | 4 | 5 | 6;
  concurrency: 1 | 2 | 3;
  metadataMode: MetadataMode;
  targetKeywords: number;
  additionalPrompt: string;
  contactSheetQuality: number;
  maxSheetSize: number;
  background: "neutral" | "white" | "gray";
  includeReleases: boolean;
  theme: AppTheme;
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
  additionalPrompt: string;
  generationScope?: "full" | "title" | "keywords";
}

export interface MetadataGenerationResult {
  batchId: string;
  assets: GeneratedMetadata[];
  missingIds: string[];
  warnings: string[];
  attempts: number;
  usage: GeminiUsageMetadata;
}

export type PopulationResearchStatus = "idle" | "initializing" | "searching" | "review" | "extracted" | "analyzing" | "ready" | "failed";
export type AdobePopulationAssetType = "vector" | "illustration" | "photo" | "image";
export type AdobePopulationSort = "relevance" | "nb_downloads" | "creation";
export type PopulationTitleSource = "initial" | "population" | "custom" | null;

export interface InitialCandidate {
  assetId: string;
  searchQuery: string;
  searchTerms: string[];
  initialTitle: string;
  visualFacts: string[];
  assetType?: string;
  visualStyle?: string;
  category: number;
  confidence: number;
}

export interface InitialCandidateRequest {
  assetId: string;
  imagePath: string;
  model: string;
}

export interface AdobePopulationSearchRequest {
  assetId: string;
  query: string;
  locale: string;
  assetType: AdobePopulationAssetType;
  sort: AdobePopulationSort;
  limit: number;
}

export interface AdobePopulationSearchResult {
  rank: number;
  url: string;
  assetId?: string;
  searchTitle?: string;
  title?: string;
  keywords?: string[];
  category?: number;
  contributor?: string;
  assetType?: string;
  creationDate?: string;
  thumbnailUrl?: string;
}

export interface AdobePopulationSearchResponse {
  searchUrl: string;
  query: string;
  locale: string;
  assetType: AdobePopulationAssetType;
  sort: AdobePopulationSort;
  results: AdobePopulationSearchResult[];
  totalFound: number;
  warnings: string[];
}

export interface PopulationSearchProgressPayload {
  assetId: string;
  current: number;
  total: number;
  currentUrl: string;
  title?: string;
  keywordsCount: number;
  statusText: string;
}

export interface AdobePopulationSample {
  sampleRank: number;
  url: string;
  assetId?: string;
  searchTitle?: string;
  title?: string;
  keywords: string[];
  category?: number;
  contributor?: string;
  assetType?: string;
  creationDate?: string;
  creationRank?: number;
  freshnessScore?: number;
  estimatedMonth?: number | null;
  estimatedYear?: number | null;
  dateSource?: string;
  dateConfidence: number;
  metadataStatus: "extracted" | "unavailable" | "failed";
  extractionError?: string;
}

export interface PopulationKeyword {
  keyword: string;
  normalizedKeyword: string;
  group: "primary_subject" | "visible_details" | "asset_type_function" | "visual_style_format" | "commercial_use" | "event_context" | "other";
  frequency: number;
  sampleCount: number;
  bestSampleRank: number;
  averageSampleRank: number;
  bestKeywordPosition: number;
  averageKeywordPosition: number;
  semanticMatch: number;
  distinctivenessAdjustment: number;
  populationScore: number;
  supportedByInput: boolean;
}

export interface AdobePopulationResearch {
  assetId: string;
  status: PopulationResearchStatus;
  stale: boolean;
  searchUrl?: string;
  query?: string;
  locale?: string;
  assetType?: AdobePopulationAssetType;
  sort?: AdobePopulationSort;
  sampleLimit?: number;
  samples: AdobePopulationSample[];
  creationResults?: AdobePopulationSearchResult[];
  keywordAggregation: PopulationKeyword[];
  recommendationTitleFromPopulation?: string;
  recommendedFocusKeywords?: string[];
  selectedTitleSource: PopulationTitleSource;
  selectedTitle?: string;
  selectedKeywords: string[];
  warnings: MetadataWarning[];
}

export interface PopulationAnalysisRequest {
  assetId: string;
  imagePath: string;
  model: string;
  initialCandidate: InitialCandidate;
  samples: AdobePopulationSample[];
  assetType: AdobePopulationAssetType;
  sort: AdobePopulationSort;
  locale: string;
}

export interface PopulationAnalysisResponse {
  recommendationTitleFromPopulation: string;
  recommendedFocusKeywords: string[];
  attempts: number;
  usage: GeminiUsageMetadata;
}

export interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  cachedContentTokenCount: number;
  thoughtsTokenCount: number;
}

export interface DailyUsage {
  date: string;
  requests: number;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ApiStatus {
  connected: boolean;
  status: "connected" | "invalid" | "rateLimited" | "failed";
  message?: string;
}

export interface LicenseStatus {
  valid: boolean;
  activated: boolean;
  product?: string;
  email?: string;
  license_id?: string;
  activation_expires_at?: string;
  expires_at?: string;
  perpetual: boolean;
  device_bound: boolean;
  activated_at?: string;
  last_validated_at?: string;
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
