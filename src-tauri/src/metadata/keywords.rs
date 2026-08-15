use std::collections::HashSet;
use std::path::Path;

pub fn normalize_keywords(raw: &[String], filename: &str, maximum: usize) -> Vec<String> {
    let filename_stem = Path::new(filename)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let filename_compact = filename_stem.replace(['-', '_'], " ");
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for value in raw {
        let keyword = value.split_whitespace().collect::<Vec<_>>().join(" ");
        let lower = keyword.to_ascii_lowercase();
        if keyword.is_empty()
            || lower == filename_stem
            || lower == filename_compact
            || lower.contains(".jpg")
            || lower.contains(".jpeg")
            || lower.contains(".png")
            || lower.contains(".webp")
            || lower.contains(".svg")
            || is_unsafe_keyword(&lower)
            || !seen.insert(lower)
        {
            continue;
        }
        normalized.push(keyword);
        if normalized.len() == maximum {
            break;
        }
    }
    normalized
}

fn is_unsafe_keyword(keyword: &str) -> bool {
    keyword.contains('™')
        || keyword.contains('®')
        || matches!(
            keyword,
            "best" | "amazing" | "beautiful" | "fantastic" | "free" | "hd" | "4k" | "premium"
                | "trending" | "viral" | "sale" | "buy now" | "click here" | "adobe"
                | "adidas" | "amazon" | "chatgpt" | "coca cola" | "disney" | "facebook"
                | "gemini" | "google" | "instagram" | "iphone" | "ipad" | "kfc" | "lego"
                | "mcdonalds" | "microsoft" | "netflix" | "nike" | "pepsi" | "photoshop"
                | "pinterest" | "samsung" | "starbucks" | "tesla" | "twitter" | "youtube"
        )
}
