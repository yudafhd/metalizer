use std::collections::HashMap;

use crate::models::{AdobePopulationSample, PopulationKeyword};

#[derive(Debug, Default)]
struct KeywordAccumulator {
    keyword: String,
    ranks: Vec<u8>,
    positions: Vec<u8>,
}

pub fn aggregate_keywords(
    samples: &[AdobePopulationSample],
    visual_facts: &[String],
) -> Vec<PopulationKeyword> {
    let extracted_sample_count = samples
        .iter()
        .filter(|sample| sample.metadata_status == "extracted")
        .count()
        .max(1);
    let mut terms: HashMap<String, KeywordAccumulator> = HashMap::new();

    for sample in samples
        .iter()
        .filter(|sample| sample.metadata_status == "extracted")
    {
        let mut seen_in_sample = std::collections::HashSet::new();
        for (index, keyword) in sample.keywords.iter().enumerate() {
            let normalized = normalize_keyword(keyword);
            if normalized.is_empty() || !seen_in_sample.insert(normalized.clone()) {
                continue;
            }
            let entry = terms
                .entry(normalized)
                .or_insert_with(|| KeywordAccumulator {
                    keyword: keyword.trim().to_string(),
                    ..Default::default()
                });
            entry.ranks.push(sample.sample_rank);
            entry
                .positions
                .push((index + 1).min(u8::MAX as usize) as u8);
        }
    }

    let mut output = terms
        .into_iter()
        .map(|(normalized, accumulator)| {
            let frequency = accumulator.ranks.len();
            let best_sample_rank = accumulator.ranks.iter().copied().min().unwrap_or(0);
            let best_keyword_position = accumulator.positions.iter().copied().min().unwrap_or(0);
            let average_sample_rank = average(&accumulator.ranks);
            let average_keyword_position = average(&accumulator.positions);
            let supported_by_input = is_supported_by_input(&normalized, visual_facts);
            let semantic_match = if supported_by_input { 1.0 } else { 0.0 };
            let distinctiveness_adjustment = if frequency == extracted_sample_count && frequency > 1
            {
                0.8
            } else if frequency <= 2 {
                1.1
            } else {
                1.0
            };
            let candidate_rank_weight = accumulator
                .ranks
                .iter()
                .map(|rank| (21.0 - f32::from((*rank).min(20))) / 20.0)
                .sum::<f32>()
                / frequency.max(1) as f32;
            let keyword_position_weight = accumulator
                .positions
                .iter()
                .map(|position| if *position <= 10 { 1.0 } else { 0.55 })
                .sum::<f32>()
                / frequency.max(1) as f32;
            let search_relevance_weight =
                (1.0 - ((average_sample_rank - 1.0) / 20.0) * 0.2).clamp(0.8, 1.0);
            let population_frequency = frequency as f32 / extracted_sample_count as f32;
            let population_score = if supported_by_input {
                round_one_decimal(
                    (population_frequency
                        * candidate_rank_weight
                        * keyword_position_weight
                        * search_relevance_weight
                        * semantic_match
                        * distinctiveness_adjustment
                        * 100.0)
                        .clamp(0.0, 100.0),
                )
            } else {
                0.0
            };
            PopulationKeyword {
                keyword: accumulator.keyword,
                normalized_keyword: normalized.clone(),
                group: classify_group(&normalized, visual_facts),
                frequency,
                sample_count: frequency,
                best_sample_rank,
                average_sample_rank: round_one_decimal(average_sample_rank),
                best_keyword_position,
                average_keyword_position: round_one_decimal(average_keyword_position),
                semantic_match,
                distinctiveness_adjustment,
                population_score,
                supported_by_input,
            }
        })
        .collect::<Vec<_>>();
    output.sort_by(|left, right| {
        right
            .population_score
            .partial_cmp(&left.population_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| right.frequency.cmp(&left.frequency))
            .then_with(|| left.best_keyword_position.cmp(&right.best_keyword_position))
            .then_with(|| left.normalized_keyword.cmp(&right.normalized_keyword))
    });
    output
}

pub fn normalize_keyword(keyword: &str) -> String {
    keyword
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn average(values: &[u8]) -> f32 {
    if values.is_empty() {
        return 0.0;
    }
    values.iter().map(|value| f32::from(*value)).sum::<f32>() / values.len() as f32
}

fn is_supported_by_input(keyword: &str, visual_facts: &[String]) -> bool {
    let normalized_facts = visual_facts
        .iter()
        .map(|fact| normalize_keyword(fact))
        .collect::<Vec<_>>();
    normalized_facts.iter().any(|fact| {
        fact == keyword
            || fact
                .split_whitespace()
                .any(|fact_word| fact_word == keyword)
            || keyword
                .split_whitespace()
                .all(|term| fact.split_whitespace().any(|fact_word| fact_word == term))
    })
}

fn classify_group(keyword: &str, visual_facts: &[String]) -> String {
    let first_fact = visual_facts
        .first()
        .map(|fact| normalize_keyword(fact))
        .unwrap_or_default();
    if keyword == first_fact || first_fact.split_whitespace().any(|term| term == keyword) {
        return "primary_subject".to_string();
    }
    if contains_any(
        keyword,
        &[
            "icon",
            "set",
            "collection",
            "logo",
            "template",
            "background",
            "banner",
            "isolated",
            "copy space",
        ],
    ) {
        return "asset_type_function".to_string();
    }
    if contains_any(
        keyword,
        &[
            "silhouette",
            "minimal",
            "flat",
            "outline",
            "line art",
            "black",
            "white",
            "vector",
            "illustration",
            "photo",
            "3d",
            "realistic",
        ],
    ) {
        return "visual_style_format".to_string();
    }
    if contains_any(
        keyword,
        &[
            "christmas",
            "wedding",
            "birthday",
            "holiday",
            "ramadan",
            "easter",
            "new year",
            "valentine",
        ],
    ) {
        return "event_context".to_string();
    }
    if contains_any(
        keyword,
        &[
            "marketing",
            "advertising",
            "business",
            "education",
            "social media",
            "presentation",
            "marketing",
        ],
    ) {
        return "commercial_use".to_string();
    }
    if is_supported_by_input(keyword, visual_facts) {
        return "visible_details".to_string();
    }
    "other".to_string()
}

fn contains_any(value: &str, terms: &[&str]) -> bool {
    terms
        .iter()
        .any(|term| value == *term || value.split_whitespace().any(|word| word == *term))
}

fn round_one_decimal(value: f32) -> f32 {
    (value * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(rank: u8, keywords: &[&str]) -> AdobePopulationSample {
        AdobePopulationSample {
            sample_rank: rank,
            url: format!("https://stock.adobe.com/images/item/{rank}"),
            asset_id: Some(rank.to_string()),
            search_title: None,
            title: None,
            keywords: keywords.iter().map(|value| (*value).to_string()).collect(),
            category: None,
            contributor: None,
            asset_type: None,
            creation_date: None,
            creation_rank: None,
            freshness_score: None,
            estimated_month: None,
            estimated_year: None,
            date_source: None,
            date_confidence: 0,
            metadata_status: "extracted".to_string(),
            extraction_error: None,
        }
    }

    #[test]
    fn frequency_and_keyword_position_use_each_sample_once() {
        let values = aggregate_keywords(
            &[
                sample(1, &["capybara", "icon"]),
                sample(2, &["CAPYBARA", "animal"]),
            ],
            &["capybara".to_string(), "animal icon".to_string()],
        );
        let capybara = values
            .iter()
            .find(|value| value.normalized_keyword == "capybara")
            .unwrap();
        assert_eq!(capybara.frequency, 2);
        assert_eq!(capybara.best_keyword_position, 1);
        assert_eq!(capybara.average_keyword_position, 1.0);
        assert!(capybara.supported_by_input);
    }

    #[test]
    fn unsupported_keyword_has_zero_semantic_score() {
        let values = aggregate_keywords(&[sample(1, &["rabbit"])], &["capybara".to_string()]);
        let rabbit = &values[0];
        assert!(!rabbit.supported_by_input);
        assert_eq!(rabbit.semantic_match, 0.0);
        assert_eq!(rabbit.population_score, 0.0);
    }
}
