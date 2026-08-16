use std::collections::HashMap;

use crate::models::{AdobePopulationSample, AdobePopulationSearchResult};

pub fn rank_samples(
    mut samples: Vec<AdobePopulationSample>,
    creation_results: &[AdobePopulationSearchResult],
) -> Vec<AdobePopulationSample> {
    let mut creation_ranks = HashMap::new();
    for result in creation_results {
        if let Some(asset_id) = &result.asset_id {
            creation_ranks
                .entry(asset_id.clone())
                .or_insert(result.rank);
        }
    }
    let population_size = creation_ranks.len().max(creation_results.len()).max(1) as u8;

    for sample in &mut samples {
        let Some(asset_id) = sample.asset_id.as_ref() else {
            clear_date_fields(sample);
            continue;
        };
        let Some(&creation_rank) = creation_ranks.get(asset_id) else {
            clear_date_fields(sample);
            continue;
        };
        sample.creation_rank = Some(creation_rank);
        sample.freshness_score = Some(freshness_score(creation_rank, population_size));
        sample.date_source = Some("relative_creation_order".to_string());
        sample.estimated_month = None;
        sample.estimated_year = None;
        sample.date_confidence = 0;
    }
    samples
}

pub fn freshness_score(creation_rank: u8, population_size: u8) -> f32 {
    if creation_rank == 0 {
        return 0.0;
    }
    if population_size <= 1 {
        return 100.0;
    }
    let rank = creation_rank.min(population_size);
    round_one_decimal((f32::from(population_size - rank) / f32::from(population_size - 1)) * 100.0)
}

fn clear_date_fields(sample: &mut AdobePopulationSample) {
    sample.creation_rank = None;
    sample.freshness_score = None;
    sample.date_source = None;
    sample.estimated_month = None;
    sample.estimated_year = None;
    sample.date_confidence = 0;
}

fn round_one_decimal(value: f32) -> f32 {
    (value * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(rank: u8, asset_id: &str) -> AdobePopulationSample {
        AdobePopulationSample {
            sample_rank: rank,
            url: format!("https://stock.adobe.com/images/item/{asset_id}"),
            asset_id: Some(asset_id.to_string()),
            search_title: None,
            title: None,
            keywords: Vec::new(),
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
    fn creation_rank_is_relative_and_date_stays_null() {
        let results = vec![
            AdobePopulationSearchResult {
                rank: 1,
                url: "https://stock.adobe.com/images/item/2".to_string(),
                asset_id: Some("2".to_string()),
                search_title: None,
                thumbnail_url: None,
                ..Default::default()
            },
            AdobePopulationSearchResult {
                rank: 2,
                url: "https://stock.adobe.com/images/item/1".to_string(),
                asset_id: Some("1".to_string()),
                search_title: None,
                thumbnail_url: None,
                ..Default::default()
            },
        ];
        let ranked = rank_samples(vec![sample(1, "1"), sample(2, "2")], &results);
        assert_eq!(ranked[0].creation_rank, Some(2));
        assert_eq!(ranked[1].creation_rank, Some(1));
        assert_eq!(ranked[1].freshness_score, Some(100.0));
        assert_eq!(ranked[0].estimated_year, None);
        assert_eq!(ranked[0].date_confidence, 0);
    }

    #[test]
    fn duplicate_creation_asset_id_keeps_first_rank() {
        let results = vec![
            AdobePopulationSearchResult {
                rank: 1,
                url: "https://stock.adobe.com/images/item/1".to_string(),
                asset_id: Some("1".to_string()),
                search_title: None,
                thumbnail_url: None,
                ..Default::default()
            },
            AdobePopulationSearchResult {
                rank: 2,
                url: "https://stock.adobe.com/images/item/1-copy".to_string(),
                asset_id: Some("1".to_string()),
                search_title: None,
                thumbnail_url: None,
                ..Default::default()
            },
        ];
        let ranked = rank_samples(vec![sample(1, "1")], &results);
        assert_eq!(ranked[0].creation_rank, Some(1));
    }
}
