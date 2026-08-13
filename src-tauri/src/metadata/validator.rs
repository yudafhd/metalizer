use std::collections::HashSet;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::keywords::normalize_keywords;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataWarning {
    pub code: String,
    pub message: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataValidation {
    pub valid: bool,
    pub warnings: Vec<MetadataWarning>,
    pub normalized_keywords: Vec<String>,
}

pub fn validate_metadata(
    filename: &str,
    title: &str,
    keywords: &[String],
    category: u8,
    maximum_keywords: usize,
) -> MetadataValidation {
    let mut warnings = Vec::new();
    let trimmed_title = title.trim();
    if trimmed_title.is_empty() {
        warnings.push(warning("title-required", "Title is required", "error"));
    }
    if trimmed_title.chars().count() > 70 {
        warnings.push(warning("title-too-long", "Title exceeds 70 characters", "error"));
    }
    if trimmed_title.contains(['\n', '\r']) {
        warnings.push(warning("title-line-break", "Title must be one line", "error"));
    }
    if contains_filename(trimmed_title, filename) {
        warnings.push(warning(
            "title-filename",
            "Title contains the original filename",
            "warning",
        ));
    }

    let normalized_keywords = normalize_keywords(keywords, filename, maximum_keywords);
    if normalized_keywords.is_empty() {
        warnings.push(warning("keywords-required", "At least one keyword is required", "error"));
    }
    if normalized_keywords.len() < 10 {
        warnings.push(warning(
            "keywords-low",
            "Fewer than 10 keywords; review discoverability",
            "warning",
        ));
    }
    if keywords.len() > maximum_keywords {
        warnings.push(warning(
            "keywords-limit",
            "Keywords exceeded the configured maximum and were trimmed",
            "warning",
        ));
    }
    let unique_count = keywords
        .iter()
        .map(|value| value.trim().to_ascii_lowercase())
        .collect::<HashSet<_>>()
        .len();
    if unique_count != keywords.len() {
        warnings.push(warning(
            "keywords-duplicate",
            "Duplicate keywords were found",
            "warning",
        ));
    }
    if !(1..=21).contains(&category) {
        warnings.push(warning("category-invalid", "Category must be between 1 and 21", "error"));
    }
    MetadataValidation {
        valid: !warnings.iter().any(|item| item.severity == "error"),
        warnings,
        normalized_keywords,
    }
}

fn contains_filename(title: &str, filename: &str) -> bool {
    let stem = Path::new(filename)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .replace(['-', '_'], " ")
        .to_ascii_lowercase();
    !stem.is_empty() && title.to_ascii_lowercase().contains(&stem)
}

fn warning(code: &str, message: &str, severity: &str) -> MetadataWarning {
    MetadataWarning {
        code: code.to_string(),
        message: message.to_string(),
        severity: severity.to_string(),
    }
}
