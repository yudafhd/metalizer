use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetDescriptor {
    pub id: String,
    pub filename: String,
    pub path: String,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub preview_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactSheetAsset {
    pub panel_id: String,
    pub path: String,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactSheetRequest {
    pub batch_id: String,
    pub assets: Vec<ContactSheetAsset>,
    pub max_sheet_size: u32,
    pub quality: u8,
    pub background: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactSheetResult {
    pub batch_id: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub assets: Vec<ContactSheetAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetMapping {
    pub id: String,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateMetadataRequest {
    pub batch_id: String,
    pub contact_sheet_path: String,
    pub expected_ids: Vec<String>,
    pub mapping: Vec<AssetMapping>,
    pub model: String,
    pub mode: String,
    pub target_keywords: u8,
    #[serde(default)]
    pub additional_prompt: String,
    #[serde(default = "default_generation_scope")]
    pub generation_scope: String,
}

fn default_generation_scope() -> String {
    "full".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedMetadata {
    pub id: String,
    pub title: String,
    pub keywords: Vec<String>,
    pub category: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataGenerationResult {
    pub batch_id: String,
    pub assets: Vec<GeneratedMetadata>,
    pub missing_ids: Vec<String>,
    pub warnings: Vec<String>,
    pub attempts: u8,
    pub usage: GeminiUsageMetadata,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiUsageMetadata {
    #[serde(default)]
    pub prompt_token_count: u64,
    #[serde(default)]
    pub candidates_token_count: u64,
    #[serde(default)]
    pub total_token_count: u64,
    #[serde(default)]
    pub cached_content_token_count: u64,
    #[serde(default)]
    pub thoughts_token_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvExportRow {
    pub filename: String,
    pub title: String,
    pub keywords: Vec<String>,
    pub category: u8,
    #[serde(default)]
    pub releases: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvExportRequest {
    pub output_path: String,
    pub rows: Vec<CsvExportRow>,
    pub include_releases: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvExportResult {
    pub files: Vec<String>,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiStatus {
    pub connected: bool,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderImageResult {
    pub paths: Vec<String>,
    pub rejected_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialCandidate {
    pub asset_id: String,
    pub search_query: String,
    pub search_terms: Vec<String>,
    pub initial_title: String,
    pub visual_facts: Vec<String>,
    pub asset_type: Option<String>,
    pub visual_style: Option<String>,
    pub category: u8,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialCandidateResponse {
    pub candidate: InitialCandidate,
    pub usage: GeminiUsageMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialCandidateRequest {
    pub asset_id: String,
    pub image_path: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdobePopulationSearchRequest {
    pub asset_id: String,
    pub query: String,
    pub locale: String,
    pub asset_type: String,
    pub sort: String,
    pub limit: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdobePopulationSearchResult {
    pub rank: u8,
    pub url: String,
    pub asset_id: Option<String>,
    pub search_title: Option<String>,
    pub title: Option<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
    pub category: Option<u8>,
    pub contributor: Option<String>,
    pub asset_type: Option<String>,
    pub creation_date: Option<String>,
    pub thumbnail_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdobePopulationSearchResponse {
    pub search_url: String,
    pub query: String,
    pub locale: String,
    pub asset_type: String,
    pub sort: String,
    pub results: Vec<AdobePopulationSearchResult>,
    pub total_found: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PopulationAnalysisRequest {
    pub asset_id: String,
    pub image_path: String,
    pub model: String,
    pub initial_candidate: InitialCandidate,
    pub samples: Vec<AdobePopulationSample>,
    pub asset_type: String,
    pub sort: String,
    pub locale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PopulationAnalysisResponse {
    pub recommendation_title_from_population: String,
    pub recommended_focus_keywords: Vec<String>,
    pub attempts: u8,
    pub usage: GeminiUsageMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdobePopulationSample {
    pub sample_rank: u8,
    pub url: String,
    pub asset_id: Option<String>,
    pub search_title: Option<String>,
    pub title: Option<String>,
    pub keywords: Vec<String>,
    pub category: Option<u8>,
    pub contributor: Option<String>,
    pub asset_type: Option<String>,
    pub creation_date: Option<String>,
    pub creation_rank: Option<u8>,
    pub freshness_score: Option<f32>,
    pub estimated_month: Option<u8>,
    pub estimated_year: Option<u16>,
    pub date_source: Option<String>,
    pub date_confidence: u8,
    #[serde(default)]
    pub source_cohort: Option<String>,
    #[serde(default)]
    pub raw_keywords: Vec<String>,
    #[serde(default)]
    pub normalized_keywords: Vec<String>,
    pub metadata_status: String,
    pub extraction_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PopulationRankingRequest {
    pub samples: Vec<AdobePopulationSample>,
    pub creation_results: Vec<AdobePopulationSearchResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PopulationKeyword {
    pub keyword: String,
    pub normalized_keyword: String,
    pub group: String,
    pub frequency: usize,
    pub sample_count: usize,
    pub best_sample_rank: u8,
    pub average_sample_rank: f32,
    pub best_keyword_position: u8,
    pub average_keyword_position: f32,
    pub semantic_match: f32,
    pub distinctiveness_adjustment: f32,
    pub population_score: f32,
    pub supported_by_input: bool,
    pub image_semantic_fit: f32,
    pub relevance_score: f32,
    pub visual_neighbor_score: f32,
    pub commercial_score: f32,
    pub freshness_score: f32,
    pub featured_score: f32,
    pub undiscovered_score: f32,
    pub position_score: f32,
    pub top_ten_frequency: f32,
    pub final_score: f32,
    pub irrelevance_penalty: f32,
    pub duplication_penalty: f32,
    pub generic_saturation_penalty: f32,
    pub unsupported_content_penalty: f32,
    pub evidence_cohorts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PopulationAggregationRequest {
    pub samples: Vec<AdobePopulationSample>,
    pub visual_facts: Vec<String>,
}
