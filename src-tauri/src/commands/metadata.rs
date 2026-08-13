use tauri::command;

use crate::metadata::scoring::quality_score;
use crate::metadata::validator::{validate_metadata, MetadataValidation};

#[command]
pub fn validate_asset_metadata(
    filename: String,
    title: String,
    keywords: Vec<String>,
    category: u8,
    maximum_keywords: usize,
) -> Result<MetadataValidation, String> {
    Ok(validate_metadata(
        &filename,
        &title,
        &keywords,
        category,
        maximum_keywords,
    ))
}

#[command]
pub fn calculate_quality_score(
    title: String,
    keywords: Vec<String>,
    category: u8,
    validation: MetadataValidation,
) -> Result<u8, String> {
    Ok(quality_score(&title, &keywords, category, &validation))
}
