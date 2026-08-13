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
