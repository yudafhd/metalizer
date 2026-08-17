use std::collections::{HashMap, HashSet};

use crate::models::{AdobePopulationSample, PopulationKeyword};

#[derive(Debug, Clone)]
struct KeywordOccurrence {
    rank: u8,
    position: u8,
    cohort: String,
    freshness_score: Option<f32>,
}

#[derive(Debug, Default)]
struct KeywordAccumulator {
    keyword: String,
    occurrences: Vec<KeywordOccurrence>,
}

pub fn aggregate_keywords(
    samples: &[AdobePopulationSample],
    visual_facts: &[String],
) -> Vec<PopulationKeyword> {
    let extracted_samples = samples
        .iter()
        .filter(|sample| sample.metadata_status == "extracted")
        .collect::<Vec<_>>();
    let extracted_sample_count = extracted_samples.len().max(1);
    let mut terms: HashMap<String, KeywordAccumulator> = HashMap::new();

    for sample in &extracted_samples {
        let mut seen_in_sample = HashSet::new();
        let cohort = sample
            .source_cohort
            .clone()
            .unwrap_or_else(|| "relevance".to_string());
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
            entry.occurrences.push(KeywordOccurrence {
                rank: sample.sample_rank,
                position: (index + 1).min(u8::MAX as usize) as u8,
                cohort: cohort.clone(),
                freshness_score: sample.freshness_score,
            });
        }
    }

    let max_relevance_weight = extracted_samples
        .iter()
        .map(|sample| rank_weight(sample.sample_rank))
        .sum::<f32>()
        .max(f32::EPSILON);
    let available_cohorts = available_cohorts(&extracted_samples);

    let mut output = terms
        .into_iter()
        .map(|(normalized, accumulator)| {
            let occurrence_count = accumulator.occurrences.len();
            let weighted_occurrence = accumulator
                .occurrences
                .iter()
                .map(|occurrence| {
                    rank_weight(occurrence.rank) * position_weight(occurrence.position)
                })
                .sum::<f32>();
            let relevance_score = (weighted_occurrence / max_relevance_weight).clamp(0.0, 1.0);
            let image_semantic_fit = semantic_fit(&normalized, visual_facts);
            let supported_by_input = image_semantic_fit >= 0.5;
            let position_score = average(
                &accumulator
                    .occurrences
                    .iter()
                    .map(|occurrence| position_weight(occurrence.position))
                    .collect::<Vec<_>>(),
            );
            let top_ten_frequency = accumulator
                .occurrences
                .iter()
                .filter(|occurrence| occurrence.position <= 10)
                .count() as f32
                / occurrence_count.max(1) as f32;
            let visual_neighbor_score = cohort_score(
                &accumulator.occurrences,
                &extracted_samples,
                "visual_neighbors",
            );
            let commercial_score =
                cohort_score(&accumulator.occurrences, &extracted_samples, "downloads");
            let featured_score =
                cohort_score(&accumulator.occurrences, &extracted_samples, "featured");
            let undiscovered_score =
                cohort_score(&accumulator.occurrences, &extracted_samples, "undiscovered");
            let freshness_score = freshness_signal(&accumulator.occurrences, &extracted_samples);
            let featured_available = available_cohorts.iter().any(|cohort| cohort == "featured");
            let raw_keyword_score = weighted_feature_score(
                image_semantic_fit,
                relevance_score,
                visual_neighbor_score,
                commercial_score,
                freshness_score,
                featured_score,
                featured_available,
                &available_cohorts,
            );
            let irrelevance_penalty = if image_semantic_fit <= 0.0 {
                1.0
            } else if image_semantic_fit < 0.75 {
                0.5
            } else {
                0.0
            };
            let duplication_penalty = 0.0;
            let generic_saturation_penalty = if occurrence_count == extracted_sample_count
                && is_generic_saturated_term(&normalized)
            {
                0.25
            } else {
                0.0
            };
            let unsupported_content_penalty = if image_semantic_fit <= 0.0 {
                1.0
            } else {
                0.0
            };
            let final_score = if image_semantic_fit <= 0.0 {
                0.0
            } else {
                (raw_keyword_score
                    - 0.15 * irrelevance_penalty
                    - 0.10 * duplication_penalty
                    - 0.10 * generic_saturation_penalty
                    - 0.20 * unsupported_content_penalty)
                .clamp(0.0, 1.0)
            };
            let distinctiveness_adjustment = if occurrence_count == extracted_sample_count
                && occurrence_count > 1
            {
                0.8
            } else if occurrence_count <= 2 {
                1.1
            } else {
                1.0
            };
            let mut evidence_cohorts = accumulator
                .occurrences
                .iter()
                .map(|occurrence| occurrence.cohort.clone())
                .collect::<HashSet<_>>()
                .into_iter()
                .collect::<Vec<_>>();
            evidence_cohorts.sort();

            PopulationKeyword {
                keyword: accumulator.keyword,
                normalized_keyword: normalized.clone(),
                group: classify_group(&normalized, visual_facts),
                frequency: occurrence_count,
                sample_count: occurrence_count,
                best_sample_rank: accumulator
                    .occurrences
                    .iter()
                    .map(|occurrence| occurrence.rank)
                    .min()
                    .unwrap_or(0),
                average_sample_rank: round_one_decimal(average_u8(
                    &accumulator
                        .occurrences
                        .iter()
                        .map(|occurrence| occurrence.rank)
                        .collect::<Vec<_>>(),
                )),
                best_keyword_position: accumulator
                    .occurrences
                    .iter()
                    .map(|occurrence| occurrence.position)
                    .min()
                    .unwrap_or(0),
                average_keyword_position: round_one_decimal(average_u8(
                    &accumulator
                        .occurrences
                        .iter()
                        .map(|occurrence| occurrence.position)
                        .collect::<Vec<_>>(),
                )),
                semantic_match: image_semantic_fit,
                distinctiveness_adjustment,
                population_score: round_one_decimal(final_score * 100.0),
                supported_by_input,
                image_semantic_fit,
                relevance_score,
                visual_neighbor_score,
                commercial_score,
                freshness_score,
                featured_score,
                undiscovered_score,
                position_score,
                top_ten_frequency,
                final_score,
                irrelevance_penalty,
                duplication_penalty,
                generic_saturation_penalty,
                unsupported_content_penalty,
                evidence_cohorts,
            }
        })
        .collect::<Vec<_>>();

    output.sort_by(|left, right| {
        right
            .final_score
            .partial_cmp(&left.final_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| right.frequency.cmp(&left.frequency))
            .then_with(|| left.best_keyword_position.cmp(&right.best_keyword_position))
            .then_with(|| left.normalized_keyword.cmp(&right.normalized_keyword))
    });
    output
}

fn rank_weight(rank: u8) -> f32 {
    1.0 / (f32::from(rank.max(1)) + 1.0).log2()
}

fn position_weight(position: u8) -> f32 {
    match position {
        1..=10 => 1.0,
        11..=25 => 0.5,
        26..=49 => 0.2,
        _ => 0.0,
    }
}

fn available_cohorts(samples: &[&AdobePopulationSample]) -> Vec<String> {
    let mut cohorts = samples
        .iter()
        .filter_map(|sample| sample.source_cohort.clone())
        .collect::<HashSet<_>>();
    if !samples.is_empty() {
        cohorts.insert("relevance".to_string());
    }
    if samples.iter().any(|sample| sample.freshness_score.is_some()) {
        cohorts.insert("freshness".to_string());
    }
    cohorts.into_iter().collect()
}

fn cohort_score(
    occurrences: &[KeywordOccurrence],
    samples: &[&AdobePopulationSample],
    cohort: &str,
) -> f32 {
    let cohort_samples = samples
        .iter()
        .filter(|sample| sample.source_cohort.as_deref().unwrap_or("relevance") == cohort)
        .collect::<Vec<_>>();
    if cohort_samples.is_empty() {
        return 0.0;
    }
    let maximum_possible = cohort_samples
        .iter()
        .map(|sample| rank_weight(sample.sample_rank))
        .sum::<f32>()
        .max(f32::EPSILON);
    let weighted_occurrence = occurrences
        .iter()
        .filter(|occurrence| occurrence.cohort == cohort)
        .map(|occurrence| rank_weight(occurrence.rank) * position_weight(occurrence.position))
        .sum::<f32>();
    (weighted_occurrence / maximum_possible).clamp(0.0, 1.0)
}

fn freshness_signal(
    occurrences: &[KeywordOccurrence],
    samples: &[&AdobePopulationSample],
) -> f32 {
    let explicit = occurrences
        .iter()
        .filter_map(|occurrence| occurrence.freshness_score)
        .map(|score| (score / 100.0).clamp(0.0, 1.0))
        .collect::<Vec<_>>();
    if !explicit.is_empty() {
        return average(&explicit);
    }
    cohort_score(occurrences, samples, "freshness")
}

fn weighted_feature_score(
    image_semantic_fit: f32,
    relevance_score: f32,
    visual_neighbor_score: f32,
    commercial_score: f32,
    freshness_score: f32,
    featured_score: f32,
    featured_available: bool,
    available_cohorts: &[String],
) -> f32 {
    let weights = if featured_available {
        [
            (0.25, image_semantic_fit, true),
            (0.20, relevance_score, true),
            (0.15, visual_neighbor_score, available_cohorts.iter().any(|cohort| cohort == "visual_neighbors")),
            (0.15, commercial_score, available_cohorts.iter().any(|cohort| cohort == "downloads")),
            (0.10, freshness_score, available_cohorts.iter().any(|cohort| cohort == "freshness")),
            (0.15, featured_score, true),
        ]
    } else {
        [
            (0.30, image_semantic_fit, true),
            (0.25, relevance_score, true),
            (0.20, visual_neighbor_score, available_cohorts.iter().any(|cohort| cohort == "visual_neighbors")),
            (0.15, commercial_score, available_cohorts.iter().any(|cohort| cohort == "downloads")),
            (0.10, freshness_score, available_cohorts.iter().any(|cohort| cohort == "freshness")),
            (0.0, featured_score, false),
        ]
    };
    let total_weight = weights
        .iter()
        .filter(|(_, _, available)| *available)
        .map(|(weight, _, _)| *weight)
        .sum::<f32>()
        .max(f32::EPSILON);
    weights
        .iter()
        .filter(|(_, _, available)| *available)
        .map(|(weight, score, _)| weight * score)
        .sum::<f32>()
        / total_weight
}

fn semantic_fit(keyword: &str, visual_facts: &[String]) -> f32 {
    let normalized_facts = visual_facts
        .iter()
        .map(|fact| normalize_keyword(fact))
        .filter(|fact| !fact.is_empty())
        .collect::<Vec<_>>();
    if normalized_facts.iter().any(|fact| fact == keyword) {
        return 1.0;
    }
    if normalized_facts.iter().any(|fact| {
        keyword
            .split_whitespace()
            .all(|term| fact.split_whitespace().any(|fact_term| fact_term == term))
    }) {
        return 0.9;
    }
    if normalized_facts.iter().any(|fact| {
        fact.split_whitespace().any(|fact_term| fact_term == keyword)
            || keyword
                .split_whitespace()
                .any(|term| fact.split_whitespace().any(|fact_term| fact_term == term))
    }) {
        return 0.55;
    }
    0.0
}

fn is_generic_saturated_term(keyword: &str) -> bool {
    [
        "design",
        "element",
        "graphic",
        "template",
        "texture",
        "abstract",
        "artwork",
    ]
    .contains(&keyword)
}

pub fn normalize_keyword(keyword: &str) -> String {
    keyword
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn average(values: &[f32]) -> f32 {
    if values.is_empty() {
        return 0.0;
    }
    values.iter().sum::<f32>() / values.len() as f32
}

fn average_u8(values: &[u8]) -> f32 {
    if values.is_empty() {
        return 0.0;
    }
    values.iter().map(|value| f32::from(*value)).sum::<f32>() / values.len() as f32
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
        ],
    ) {
        return "commercial_use".to_string();
    }
    if semantic_fit(keyword, visual_facts) >= 0.5 {
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
            source_cohort: Some("relevance".to_string()),
            raw_keywords: Vec::new(),
            normalized_keywords: Vec::new(),
            metadata_status: "extracted".to_string(),
            extraction_error: None,
        }
    }

    #[test]
    fn rank_and_position_weights_favor_top_results() {
        assert!(rank_weight(1) > rank_weight(10));
        assert_eq!(position_weight(10), 1.0);
        assert_eq!(position_weight(11), 0.5);
        assert_eq!(position_weight(26), 0.2);
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
        assert!(capybara.relevance_score > 0.8);
        assert!(capybara.final_score > 0.7);
    }

    #[test]
    fn unsupported_keyword_is_penalized_to_zero() {
        let values = aggregate_keywords(&[sample(1, &["rabbit"])], &["capybara".to_string()]);
        let rabbit = &values[0];
        assert!(!rabbit.supported_by_input);
        assert_eq!(rabbit.semantic_match, 0.0);
        assert_eq!(rabbit.population_score, 0.0);
        assert_eq!(rabbit.final_score, 0.0);
    }
}
