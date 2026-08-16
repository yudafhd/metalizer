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
        warnings.push(warning("title-required", "Title wajib diisi", "error"));
    }
    if trimmed_title.chars().count() > 70 {
        warnings.push(warning(
            "title-too-long",
            "Title lebih dari 70 karakter",
            "error",
        ));
    }
    if trimmed_title.contains(['\n', '\r']) {
        warnings.push(warning(
            "title-line-break",
            "Title harus satu baris",
            "error",
        ));
    }
    let title_word_count = trimmed_title.split_whitespace().count();
    if !trimmed_title.is_empty() && !(5..=10).contains(&title_word_count) {
        warnings.push(warning(
            "title-word-count",
            "Title sebaiknya terdiri dari 5–10 kata yang natural",
            "warning",
        ));
    }
    if contains_filename(trimmed_title, filename) {
        warnings.push(warning(
            "title-filename",
            "Title masih memuat nama file asli",
            "warning",
        ));
    }

    let normalized_keywords = normalize_keywords(keywords, filename, maximum_keywords);
    if normalized_keywords.is_empty() {
        warnings.push(warning(
            "keywords-required",
            "Minimal satu keyword wajib diisi",
            "error",
        ));
    }
    if normalized_keywords.len() < 10 {
        warnings.push(warning(
            "keywords-low",
            "Keyword kurang dari 10; hasil pencarian mungkin kurang mudah ditemukan",
            "warning",
        ));
    }
    if normalized_keywords.len() < 20 {
        warnings.push(warning(
            "keywords-ideal-low",
            "Sebaiknya gunakan 20–35 keyword yang benar-benar relevan",
            "warning",
        ));
    }
    if normalized_keywords.len() > 35 && normalized_keywords.len() <= maximum_keywords {
        warnings.push(warning(
            "keywords-ideal-high",
            "Keyword lebih dari 35; hapus yang paling umum atau kurang relevan",
            "warning",
        ));
    }
    if keywords.len() > maximum_keywords {
        warnings.push(warning(
            "keywords-limit",
            "Keyword melebihi batas dan sudah dipotong",
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
            "Ada keyword yang sama",
            "warning",
        ));
    }
    if !(1..=21).contains(&category) {
        warnings.push(warning(
            "category-invalid",
            "Kategori harus berada di antara 1 sampai 21",
            "error",
        ));
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
