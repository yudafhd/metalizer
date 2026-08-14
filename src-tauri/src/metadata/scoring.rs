use std::collections::HashSet;

use super::validator::MetadataValidation;

pub fn quality_score(title: &str, keywords: &[String], category: u8, validation: &MetadataValidation) -> u8 {
    let title_quality = if !title.trim().is_empty() && title.chars().count() <= 70 {
        20
    } else {
        0
    };
    let keyword_count = match keywords.len() {
        20..=35 => 10,
        10..=19 | 36..=49 => 7,
        _ => 0,
    };
    let unique = keywords
        .iter()
        .map(|item| item.trim().to_ascii_lowercase())
        .collect::<HashSet<_>>();
    let uniqueness = if keywords.is_empty() {
        0
    } else {
        ((unique.len() as f32 / keywords.len() as f32) * 15.0).round() as u8
    };
    let first_ten = if keywords.len() >= 10 { 25 } else { (keywords.len() as u8 * 25) / 10 };
    let category_score = if (1..=21).contains(&category) { 10 } else { 0 };
    let completeness = if !title.trim().is_empty() && !keywords.is_empty() { 10 } else { 0 };
    let safety = if validation.valid { 10 } else { 3 };
    title_quality + keyword_count + uniqueness + first_ten + category_score + completeness + safety
}
