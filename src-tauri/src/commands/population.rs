use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use reqwest::header::{ACCEPT, ACCEPT_LANGUAGE, USER_AGENT};
use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PopulationSearchProgressPayload {
    pub asset_id: String,
    pub current: usize,
    pub total: usize,
    pub current_url: String,
    pub title: Option<String>,
    pub keywords_count: usize,
    pub status_text: String,
}

use crate::ai::population::GeminiPopulationProvider;
use crate::errors::{command_error, AppError};
use crate::models::{
    AdobePopulationSearchRequest, AdobePopulationSearchResponse, InitialCandidate,
    InitialCandidateRequest, PopulationAggregationRequest, PopulationAnalysisRequest,
    PopulationAnalysisResponse, PopulationKeyword, PopulationRankingRequest,
};
use crate::population::adobe::parse_search_html;
use crate::population::{
    aggregate_keywords, build_search_url, rank_samples, scrape_population_full_webview,
    validate_search_request,
};
use crate::state::AppState;

#[command]
pub async fn analyze_initial_candidate(
    request: InitialCandidateRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<InitialCandidate, String> {
    crate::commands::license::require_license(&app)?;
    let api_key = api_key(&state)?;
    let cancellation_key = format!("initial:{}", request.asset_id);
    let cancellation = register_cancellation(&state, &cancellation_key)?;
    let provider = GeminiPopulationProvider::new(api_key, cancellation);
    let result = provider
        .analyze_initial(&request)
        .await
        .map_err(command_error);
    remove_cancellation(&state, &cancellation_key);
    result
}

#[command]
pub async fn search_adobe_population(
    request: AdobePopulationSearchRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AdobePopulationSearchResponse, String> {
    crate::commands::license::require_license(&app)?;
    validate_search_request(&request).map_err(command_error)?;
    let request = AdobePopulationSearchRequest {
        limit: request.limit.min(20),
        ..request
    };
    let search_url = build_search_url(&request).map_err(command_error)?;
    let cache_key = format!(
        "{}|{}|{}|{}",
        request.query.trim().to_lowercase(),
        request.locale.trim().to_lowercase(),
        request.asset_type,
        request.sort
    );
    if request.sort != "relevance" {
        if let Ok(cache) = state.population_search_cache.lock() {
            if let Some(cached) = cache.get(&cache_key) {
                let has_keywords = !cached.results.is_empty()
                    && cached.results.iter().all(|r| !r.keywords.is_empty());
                if has_keywords {
                    return Ok(cached.clone());
                }
            }
        }
    }
    {
        let mut active = state
            .active_population_searches
            .lock()
            .map_err(|_| "Could not access population search state".to_string())?;
        if !active.insert(request.asset_id.clone()) {
            return Err("Satu population search sudah aktif untuk asset ini".to_string());
        }
    }
    let result = fetch_adobe_population(&app, &request, &search_url).await;
    if let Ok(mut active) = state.active_population_searches.lock() {
        active.remove(&request.asset_id);
    }
    let result = result.map_err(command_error)?;
    if let Ok(mut cache) = state.population_search_cache.lock() {
        cache.insert(cache_key, result.clone());
    }
    Ok(result)
}

#[command]
pub async fn analyze_adobe_population(
    request: PopulationAnalysisRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PopulationAnalysisResponse, String> {
    crate::commands::license::require_license(&app)?;
    if request.samples.len() > 20 {
        return Err("Population analysis hanya menerima maksimal 20 sample".to_string());
    }
    let api_key = api_key(&state)?;
    let cancellation_key = format!("population:{}", request.asset_id);
    let cancellation = register_cancellation(&state, &cancellation_key)?;
    let provider = GeminiPopulationProvider::new(api_key, cancellation);
    let result = provider
        .analyze_population(&request)
        .await
        .map_err(command_error);
    remove_cancellation(&state, &cancellation_key);
    result
}

#[command]
pub fn cancel_population_analysis(
    asset_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    for key in [
        format!("population:{}", asset_id),
        format!("initial:{}", asset_id),
    ] {
        if let Ok(cancellations) = state.cancellations.lock() {
            if let Some(cancellation) = cancellations.get(&key) {
                cancellation.store(true, Ordering::Relaxed);
            }
        }
    }
    Ok(())
}

#[command]
pub fn calculate_population_ranking(
    request: PopulationRankingRequest,
) -> Result<Vec<crate::models::AdobePopulationSample>, String> {
    Ok(rank_samples(request.samples, &request.creation_results))
}

#[command]
pub fn aggregate_population_keywords(
    request: PopulationAggregationRequest,
) -> Result<Vec<PopulationKeyword>, String> {
    Ok(aggregate_keywords(&request.samples, &request.visual_facts))
}

async fn fetch_adobe_population(
    app: &AppHandle,
    request: &AdobePopulationSearchRequest,
    search_url: &str,
) -> Result<AdobePopulationSearchResponse, AppError> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| AppError::Network(error.to_string()))?;

    let mut warnings = Vec::new();
    let mut results = Vec::new();
    match client
        .get(search_url)
        .header(USER_AGENT, "Metalizer/0.2 Adobe Stock population research")
        .header(ACCEPT, "text/html,application/xhtml+xml")
        .header(ACCEPT_LANGUAGE, request.locale.as_str())
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => match response.text().await {
            Ok(html) => {
                let (parsed, parser_warnings) = parse_search_html(&html, request.limit as usize);
                results = parsed;
                warnings.extend(parser_warnings);
            }
            Err(error) => {
                warnings.push(format!("Respons HTML Adobe tidak dapat dibaca: {}", error))
            }
        },
        Ok(response) => warnings.push(format!(
            "Adobe Stock search mengembalikan HTTP {}",
            response.status().as_u16()
        )),
        Err(error) => warnings.push(format!("HTTP search Adobe tidak tersedia: {}", error)),
    }

    let _ = app.emit(
        "population-search-progress",
        PopulationSearchProgressPayload {
            asset_id: request.asset_id.clone(),
            current: 0,
            total: request.limit as usize,
            current_url: search_url.to_string(),
            title: None,
            keywords_count: 0,
            status_text: if request.sort == "relevance" || results.is_empty() {
                "Membuka browser untuk mencari sample Adobe Stock...".to_string()
            } else {
                format!(
                    "Ditemukan {} sample. Menyiapkan URL untuk Gemini...",
                    results.len()
                )
            },
        },
    );

    if request.sort == "relevance" || results.is_empty() {
        match scrape_population_full_webview(
            app,
            search_url,
            request.limit as usize,
            |current, total, url, title, kw_count| {
                let _ = app.emit(
                    "population-search-progress",
                    PopulationSearchProgressPayload {
                        asset_id: request.asset_id.clone(),
                        current,
                        total,
                        current_url: url.to_string(),
                        title: title.map(String::from),
                        keywords_count: kw_count,
                        status_text: format!(
                            "Membuka detail Adobe via browser ({}/{})...",
                            current, total
                        ),
                    },
                );
            },
        )
        .await
        {
            Ok(browser_results) if !browser_results.is_empty() => results = browser_results,
            Ok(_) => warnings.push(
                "Browser Adobe tidak menemukan sample; hasil HTTP dipakai sebagai fallback"
                    .to_string(),
            ),
            Err(error) => warnings.push(format!("Browser Adobe tidak dapat dibuka: {}", error)),
        }
    }

    if results.is_empty() {
        return Err(AppError::Network(
            "Adobe Stock tidak mengembalikan sample untuk query ini. Coba query Inggris yang lebih umum atau nonaktifkan filter tipe asset.".to_string(),
        ));
    }

    let total = results.len();
    let _ = app.emit(
        "population-search-progress",
        PopulationSearchProgressPayload {
            asset_id: request.asset_id.clone(),
            current: total,
            total,
            current_url: search_url.to_string(),
            title: None,
            keywords_count: results.iter().map(|r| r.keywords.len()).sum(),
            status_text: format!("Selesai mengekstrak {} sample.", total),
        },
    );

    Ok(AdobePopulationSearchResponse {
        search_url: search_url.to_string(),
        query: request.query.clone(),
        locale: request.locale.clone(),
        asset_type: request.asset_type.clone(),
        sort: request.sort.clone(),
        total_found: results.len(),
        results,
        warnings,
    })
}

fn api_key(state: &State<'_, AppState>) -> Result<String, String> {
    state
        .api_key
        .lock()
        .map_err(|_| "Could not access API key state".to_string())?
        .as_ref()
        .map(|value| value.to_string())
        .ok_or_else(|| "Gemini API key belum diatur".to_string())
}

fn register_cancellation(
    state: &State<'_, AppState>,
    key: &str,
) -> Result<Arc<AtomicBool>, String> {
    let cancellation = Arc::new(AtomicBool::new(false));
    let mut cancellations = state
        .cancellations
        .lock()
        .map_err(|_| "Could not access cancellation state".to_string())?;
    if cancellations.contains_key(key) {
        return Err("Analisis staged sudah aktif untuk asset ini".to_string());
    }
    cancellations.insert(key.to_string(), cancellation.clone());
    Ok(cancellation)
}

fn remove_cancellation(state: &State<'_, AppState>, key: &str) {
    if let Ok(mut cancellations) = state.cancellations.lock() {
        cancellations.remove(key);
    }
}
