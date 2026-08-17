use std::fs;
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::errors::{AppError, AppResult};
use crate::images::preprocess::{mime_type_for_path, open_image};
use crate::models::{
    GeminiUsageMetadata, InitialCandidate, InitialCandidateRequest, InitialCandidateResponse,
    PopulationAnalysisRequest, PopulationAnalysisResponse,
};

const MAX_URLS: usize = 20;
const INITIAL_CANDIDATE_MAX_DIMENSION: u32 = 1024;
const INITIAL_CANDIDATE_JPEG_QUALITY: u8 = 75;

pub struct GeminiPopulationProvider {
    api_key: String,
    cancellation: Arc<AtomicBool>,
}

impl GeminiPopulationProvider {
    pub fn new(api_key: String, cancellation: Arc<AtomicBool>) -> Self {
        Self {
            api_key,
            cancellation,
        }
    }

    pub async fn analyze_initial(
        &self,
        request: &InitialCandidateRequest,
    ) -> AppResult<InitialCandidateResponse> {
        let (mime_type, image_data) = read_initial_candidate_image(&request.image_path)?;
        let body = json!({
            "systemInstruction": { "parts": [{ "text": initial_system_prompt() }] },
            "contents": [{
                "role": "user",
                "parts": [
                    { "text": format!("Analyze this single uploaded asset. Internal asset id: {}", request.asset_id) },
                    { "inlineData": { "mimeType": mime_type, "data": image_data } }
                ]
            }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": initial_response_schema(),
                "maxOutputTokens": 2048
            }
        });
        let payload = self
            .request_with_retry(&request.model, &body, "initial candidate")
            .await?;
        let wire: InitialCandidateWire = parse_structured_response(&payload)?;
        validate_initial_wire(&wire, &request.asset_id)?;
        let candidate = InitialCandidate {
            asset_id: request.asset_id.clone(),
            search_query: wire.search_query.trim().to_string(),
            search_terms: if wire.search_terms.is_empty() {
                wire.search_query
                    .split_whitespace()
                    .map(str::to_lowercase)
                    .collect()
            } else {
                wire.search_terms.into_iter().take(3).collect()
            },
            initial_title: clean_text(&wire.initial_title),
            visual_facts: wire.visual_facts,
            asset_type: wire.asset_type,
            visual_style: wire.visual_style,
            category: wire.category as u8,
            confidence: wire.confidence.clamp(0.0, 1.0),
        };
        let usage = payload
            .get("usageMetadata")
            .or_else(|| payload.get("usage_metadata"))
            .cloned()
            .and_then(|value| serde_json::from_value::<GeminiUsageMetadata>(value).ok())
            .unwrap_or_default();
        Ok(InitialCandidateResponse { candidate, usage })
    }

    pub async fn analyze_population(
        &self,
        request: &PopulationAnalysisRequest,
    ) -> AppResult<PopulationAnalysisResponse> {
        if request.samples.is_empty() || request.samples.len() > MAX_URLS {
            return Err(AppError::InvalidRequest(
                "Population analysis membutuhkan 1-20 sample".to_string(),
            ));
        }
        let (mime_type, image_data) = read_inline_image(&request.image_path)?;
        let population_data = serde_json::to_string_pretty(&request.samples).map_err(|error| {
            AppError::InvalidRequest(format!(
                "Data metadata population tidak dapat disiapkan: {}",
                error
            ))
        })?;
        let prompt = format!(
            "Analyze the original uploaded image using the Adobe Stock population metadata collected in Stage 2 by the visible WebView. This is the final analysis phase; do not browse or extract URLs again.\n\nINITIAL TITLE: {}\nSEARCH QUERY: {}\nVISUAL FACTS: {}\nASSET TYPE: {}\nSORT: {}\nLOCALE: {}\n\nSTAGE 2 POPULATION METADATA (treat unavailable records as unusable evidence):\n{}\n\nReturn a recommendation title for the original image and recommended_focus_keywords. The recommendation must describe the original image. A focus keyword is allowed only when supported by the original image or its visual facts. Never copy a sample title in full and never invent metadata for unavailable samples.",
            request.initial_candidate.initial_title,
            request.initial_candidate.search_query,
            request.initial_candidate.visual_facts.join(", "),
            request.asset_type,
            request.sort,
            request.locale,
            population_data
        );
        let body = json!({
            "systemInstruction": { "parts": [{ "text": population_analysis_system_prompt() }] },
            "contents": [{
                "role": "user",
                "parts": [
                    { "text": prompt },
                    { "inlineData": { "mimeType": mime_type, "data": image_data } }
                ]
            }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": population_analysis_response_schema(),
                "thinkingConfig": { "thinkingLevel": "low" },
                "maxOutputTokens": 4096
            }
        });
        let payload = self
            .request_with_retry(&request.model, &body, "population analysis")
            .await?;
        let wire: PopulationAnalysisWire = parse_structured_response(&payload)?;
        if wire.recommendation_title_from_population.trim().is_empty() {
            return Err(AppError::GeminiResponse(
                "Gemini tidak mengembalikan recommendation_title_from_population".to_string(),
            ));
        }
        let usage = payload
            .get("usageMetadata")
            .or_else(|| payload.get("usage_metadata"))
            .cloned()
            .and_then(|value| serde_json::from_value::<GeminiUsageMetadata>(value).ok())
            .unwrap_or_default();
        Ok(PopulationAnalysisResponse {
            recommendation_title_from_population: clean_text(
                &wire.recommendation_title_from_population,
            ),
            recommended_focus_keywords: wire
                .recommended_focus_keywords
                .into_iter()
                .map(|keyword| clean_text(&keyword))
                .filter(|keyword| !keyword.is_empty())
                .take(20)
                .collect(),
            attempts: 1,
            usage,
        })
    }

    async fn request_with_retry(
        &self,
        model: &str,
        body: &Value,
        operation: &str,
    ) -> AppResult<Value> {
        if self.cancellation.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(90))
            .build()
            .map_err(|error| AppError::Network(error.to_string()))?;
        let model = model.trim().trim_start_matches("models/");
        if model.is_empty() {
            return Err(AppError::InvalidRequest("Model Gemini kosong".to_string()));
        }
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
            model
        );
        let mut last_error = None;
        for attempt in 1..=3u8 {
            if self.cancellation.load(Ordering::Relaxed) {
                return Err(AppError::Cancelled);
            }
            match self.send_request(&client, &url, body).await {
                Ok(payload) => return Ok(payload),
                Err(error) if is_retryable(&error) && attempt < 3 => {
                    tracing::warn!(
                        operation,
                        attempt,
                        "retrying transient staged Gemini failure"
                    );
                    last_error = Some(error);
                    sleep_or_cancel(
                        self.cancellation.clone(),
                        Duration::from_secs(if attempt == 1 { 2 } else { 5 }),
                    )
                    .await?;
                }
                Err(error) => return Err(error),
            }
        }
        Err(last_error
            .unwrap_or_else(|| AppError::Network("Request Gemini staged gagal".to_string())))
    }

    async fn send_request(&self, client: &Client, url: &str, body: &Value) -> AppResult<Value> {
        let request = client
            .post(url)
            .header("x-goog-api-key", self.api_key.as_str())
            .json(body)
            .send();
        let response = tokio::select! {
            _ = wait_for_cancellation(self.cancellation.clone()) => return Err(AppError::Cancelled),
            response = request => response.map_err(|error| AppError::Network(error.to_string()))?
        };
        let status = response.status();
        let body_text = response
            .text()
            .await
            .map_err(|error| AppError::Network(error.to_string()))?;
        let payload: Value = serde_json::from_str(&body_text).map_err(|error| {
            if status.is_success() {
                AppError::GeminiResponse(format!("Respons Gemini staged bukan JSON: {}", error))
            } else {
                AppError::Gemini {
                    status: status.as_u16(),
                    message: error.to_string(),
                }
            }
        })?;
        if !status.is_success() {
            let message = gemini_error_message(&payload);
            return Err(AppError::Gemini {
                status: status.as_u16(),
                message,
            });
        }
        Ok(payload)
    }
}

fn gemini_error_message(payload: &Value) -> String {
    let error = payload.get("error");
    let message = error
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("Gemini menolak request staged");
    let status = error
        .and_then(|error| error.get("status"))
        .and_then(Value::as_str);
    let details = error.and_then(|error| error.get("details"));

    let mut context = Vec::new();
    if let Some(status) = status {
        context.push(format!("status={status}"));
    }
    if let Some(details) = details.filter(|details| !details.is_null()) {
        if let Ok(details) = serde_json::to_string(details) {
            const MAX_DETAILS_LENGTH: usize = 2_000;
            let details = if details.len() > MAX_DETAILS_LENGTH {
                format!(
                    "{}...",
                    details.chars().take(MAX_DETAILS_LENGTH).collect::<String>()
                )
            } else {
                details
            };
            context.push(format!("details={details}"));
        }
    }

    if context.is_empty() {
        message.to_string()
    } else {
        format!("{message} ({})", context.join("; "))
    }
}

fn read_inline_image(path: &str) -> AppResult<(&'static str, String)> {
    let path = std::path::Path::new(path);
    let mime_type = mime_type_for_path(path).ok_or_else(|| {
        AppError::InvalidRequest("Format gambar tidak didukung Gemini".to_string())
    })?;
    if mime_type == "image/svg+xml" {
        let image = open_image(path)?;
        let mut bytes = Vec::new();
        image
            .write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Jpeg)
            .map_err(AppError::from)?;
        return Ok(("image/jpeg", STANDARD.encode(bytes)));
    }
    Ok((mime_type, STANDARD.encode(fs::read(path)?)))
}

fn read_initial_candidate_image(path: &str) -> AppResult<(&'static str, String)> {
    let image = open_image(std::path::Path::new(path))?
        .thumbnail(
            INITIAL_CANDIDATE_MAX_DIMENSION,
            INITIAL_CANDIDATE_MAX_DIMENSION,
        )
        .to_rgb8();
    let mut bytes = Vec::new();
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
        &mut bytes,
        INITIAL_CANDIDATE_JPEG_QUALITY,
    );
    encoder.encode_image(&image::DynamicImage::ImageRgb8(image))?;
    Ok(("image/jpeg", STANDARD.encode(bytes)))
}

fn validate_initial_wire(wire: &InitialCandidateWire, expected_asset_id: &str) -> AppResult<()> {
    if wire.asset_id != expected_asset_id {
        return Err(AppError::GeminiResponse(
            "asset_id kandidat awal tidak cocok dengan asset yang dianalisis".to_string(),
        ));
    }
    let words = wire.search_query.split_whitespace().count();
    if !(2..=3).contains(&words)
        || !wire.search_query.chars().all(|character| {
            character.is_ascii_alphabetic() || character == '-' || character.is_ascii_whitespace()
        })
    {
        return Err(AppError::GeminiResponse(
            "search_query Gemini harus berupa 2-3 kata Inggris".to_string(),
        ));
    }
    if wire.initial_title.trim().is_empty() || wire.visual_facts.is_empty() {
        return Err(AppError::GeminiResponse(
            "Kandidat awal Gemini tidak lengkap".to_string(),
        ));
    }
    if !(1..=21).contains(&wire.category) {
        return Err(AppError::GeminiResponse(
            "Kategori kandidat awal Gemini tidak valid".to_string(),
        ));
    }
    Ok(())
}

fn parse_structured_response<T: for<'de> Deserialize<'de>>(payload: &Value) -> AppResult<T> {
    let candidates = payload.get("candidates").and_then(Value::as_array);

    let first_candidate = candidates.and_then(|candidates| candidates.first());

    let parts = first_candidate
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(Value::as_array);

    let text = parts.and_then(|parts| {
        parts
            .iter()
            .filter(|part| {
                !part
                    .get("thought")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
            })
            .find_map(|part| part.get("text").and_then(Value::as_str))
            .or_else(|| {
                parts
                    .iter()
                    .find_map(|part| part.get("text").and_then(Value::as_str))
            })
    });

    let text = match text {
        Some(text) => text,
        None => {
            let finish_reason = first_candidate
                .and_then(|c| c.get("finishReason"))
                .and_then(Value::as_str)
                .unwrap_or("UNKNOWN");
            let prompt_feedback = payload
                .get("promptFeedback")
                .and_then(|f| serde_json::to_string(f).ok());
            return Err(AppError::GeminiResponse(format!(
                "Respons Gemini staged tidak berisi teks JSON (finishReason: {}{})",
                finish_reason,
                prompt_feedback
                    .map(|f| format!(", promptFeedback: {}", f))
                    .unwrap_or_default()
            )));
        }
    };

    let trimmed = text.trim();
    let cleaned = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
        .and_then(|value| value.strip_suffix("```"))
        .map(str::trim)
        .unwrap_or(trimmed);
    serde_json::from_str(cleaned).map_err(|error| {
        AppError::GeminiResponse(format!("Structured JSON staged tidak valid: {}", error))
    })
}

fn clean_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_retryable(error: &AppError) -> bool {
    matches!(error, AppError::Network(_))
        || matches!(error, AppError::Gemini { status, .. } if *status == 429 || (500..=599).contains(status))
}

async fn wait_for_cancellation(cancellation: Arc<AtomicBool>) {
    while !cancellation.load(Ordering::Relaxed) {
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

async fn sleep_or_cancel(cancellation: Arc<AtomicBool>, duration: Duration) -> AppResult<()> {
    tokio::select! {
        _ = tokio::time::sleep(duration) => Ok(()),
        _ = wait_for_cancellation(cancellation) => Err(AppError::Cancelled),
    }
}

fn initial_system_prompt() -> &'static str {
    "You are analyzing one uploaded Adobe Stock asset. Return structured JSON only. Create a search_query in English with exactly 2 or 3 main words, search_terms matching it, and an initial_title using [primary subject/event] + [asset type/function] + [visual style/format]. Use only visible facts. Never use the filename, a year, unsupported objects, or copied Adobe Stock titles. visual_facts must be concise visible evidence."
}

fn population_analysis_system_prompt() -> &'static str {
    "You are a conservative Adobe Stock population analyst. The request contains the original uploaded image and metadata extracted in an earlier phase. Analyze only the extracted records marked extracted and use them as population evidence, never as facts about the original image. The recommendation must describe the original image. A focus keyword is allowed only when supported by the original image or its visual facts. Never copy a sample title in full and never invent metadata for unavailable records. Return structured JSON only."
}

fn initial_response_schema() -> Value {
    json!({
        "type": "OBJECT",
        "properties": {
            "asset_id": { "type": "STRING" },
            "search_query": { "type": "STRING" },
            "search_terms": { "type": "ARRAY", "items": { "type": "STRING" } },
            "initial_title": { "type": "STRING" },
            "visual_facts": { "type": "ARRAY", "items": { "type": "STRING" } },
            "asset_type": { "type": "STRING" },
            "visual_style": { "type": "STRING" },
            "category": { "type": "INTEGER" },
            "confidence": { "type": "NUMBER" }
        },
        "required": ["asset_id", "search_query", "search_terms", "initial_title", "visual_facts", "category", "confidence"]
    })
}

fn population_analysis_response_schema() -> Value {
    json!({
        "type": "OBJECT",
        "properties": {
            "recommendation_title_from_population": { "type": "STRING" },
            "recommended_focus_keywords": { "type": "ARRAY", "items": { "type": "STRING" } }
        },
        "required": ["recommendation_title_from_population", "recommended_focus_keywords"]
    })
}

#[derive(Debug, Deserialize)]
struct InitialCandidateWire {
    asset_id: String,
    search_query: String,
    #[serde(default)]
    search_terms: Vec<String>,
    initial_title: String,
    visual_facts: Vec<String>,
    asset_type: Option<String>,
    visual_style: Option<String>,
    category: i64,
    confidence: f32,
}

#[derive(Debug, Deserialize)]
struct PopulationAnalysisWire {
    recommendation_title_from_population: String,
    #[serde(default)]
    recommended_focus_keywords: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn generate_content_schemas_use_scalar_nullable_proto_fields() {
        let initial = initial_response_schema();
        assert_eq!(initial["properties"]["asset_type"]["type"], "STRING");
        assert_eq!(initial["properties"]["visual_style"]["type"], "STRING");

        let analysis = population_analysis_response_schema();
        assert_eq!(analysis["type"], "OBJECT");
        assert_eq!(
            analysis["properties"]
                .as_object()
                .map(|properties| properties.len()),
            Some(2)
        );
        assert_eq!(
            analysis["properties"]["recommended_focus_keywords"]["type"],
            "ARRAY"
        );
    }

    #[test]
    fn gemini_error_includes_api_details() {
        let payload = json!({
            "error": {
                "message": "Request contains an invalid argument.",
                "status": "INVALID_ARGUMENT",
                "details": [{ "field": "generation_config" }]
            }
        });
        let message = gemini_error_message(&payload);
        assert!(message.contains("Request contains an invalid argument."));
        assert!(message.contains("status=INVALID_ARGUMENT"));
        assert!(message.contains("generation_config"));
    }
}
