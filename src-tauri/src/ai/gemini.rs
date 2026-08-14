use std::collections::HashSet;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::ai::prompts::{system_prompt, user_prompt};
use crate::ai::schema::metadata_response_schema;
use crate::errors::{AppError, AppResult};
use crate::models::{GeminiUsageMetadata, GeneratedMetadata, GenerateMetadataRequest, MetadataGenerationResult};

pub struct GeminiMetadataProvider {
    api_key: String,
    cancellation: Arc<AtomicBool>,
}

impl GeminiMetadataProvider {
    pub fn new(api_key: String, cancellation: Arc<AtomicBool>) -> Self {
        Self {
            api_key,
            cancellation,
        }
    }

    pub async fn generate(
        &self,
        request: &GenerateMetadataRequest,
    ) -> AppResult<MetadataGenerationResult> {
        if request.expected_ids.is_empty() {
            return Err(AppError::InvalidRequest(
                "expectedIds must contain at least one panel ID".to_string(),
            ));
        }
        if request.expected_ids.len() > 6 {
            return Err(AppError::InvalidRequest(
                "A Gemini request may contain at most six panel IDs".to_string(),
            ));
        }
        if self.cancellation.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }

        let image_bytes = fs::read(&request.contact_sheet_path)?;
        let image_base64 = STANDARD.encode(image_bytes);
        let body = json!({
            "systemInstruction": {
                "parts": [{ "text": system_prompt(&request.mode, request.target_keywords, &request.generation_scope) }]
            },
            "contents": [{
                "role": "user",
                "parts": [
                    { "text": user_prompt(&request.mapping) },
                    { "inlineData": { "mimeType": "image/jpeg", "data": image_base64 } }
                ]
            }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": metadata_response_schema(),
                "maxOutputTokens": 8192
            }
        });

        let client = Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(90))
            .build()
            .map_err(|error| AppError::Network(error.to_string()))?;
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
            request.model.trim()
        );

        let mut last_error = None;
        for attempt in 1..=3u8 {
            if self.cancellation.load(Ordering::Relaxed) {
                return Err(AppError::Cancelled);
            }
            match self.send_request(&client, &url, &body).await {
                Ok(payload) => match parse_response(request, &payload) {
                    Ok(mut result) => {
                        result.attempts = attempt;
                        return Ok(result);
                    }
                    Err(error) if attempt < 3 => {
                        last_error = Some(error);
                        sleep_or_cancel(self.cancellation.clone(), Duration::from_secs(match attempt {
                            1 => 2,
                            2 => 5,
                            _ => 10,
                        })).await?;
                    }
                    Err(error) => return Err(error),
                },
                Err(error) if is_retryable(&error) && attempt < 3 => {
                    last_error = Some(error);
                    tracing::warn!(batch_id = %request.batch_id, attempt, "retrying transient Gemini failure");
                    let delay = match attempt {
                        1 => 2,
                        2 => 5,
                        _ => 10,
                    };
                    sleep_or_cancel(self.cancellation.clone(), Duration::from_secs(delay)).await?;
                }
                Err(error) => return Err(error),
            }
        }

        Err(last_error.unwrap_or_else(|| {
            AppError::Network("Request Gemini gagal setelah tiga kali percobaan".to_string())
        }))
    }

    async fn send_request(&self, client: &Client, url: &str, body: &Value) -> AppResult<Value> {
        if self.cancellation.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }

        let request = client.post(url).query(&[("key", self.api_key.as_str())]).json(body).send();
        let response = tokio::select! {
            _ = wait_for_cancellation(self.cancellation.clone()) => return Err(AppError::Cancelled),
            response = request => response.map_err(|error| {
                if error.is_timeout() || error.is_connect() {
                    AppError::Network(error.to_string())
                } else {
                    AppError::Network(error.to_string())
                }
            })?
        };
        let status = response.status();
        let body_text = response
            .text()
            .await
            .map_err(|error| AppError::Network(error.to_string()))?;
        let payload: Value = match serde_json::from_str(&body_text) {
            Ok(payload) => payload,
            Err(error) if !status.is_success() => {
                return Err(AppError::Gemini {
                    status: status.as_u16(),
                    message: format!("Gemini returned a non-JSON HTTP error: {}", error),
                });
            }
            Err(error) => {
                return Err(AppError::GeminiResponse(format!(
                    "Gemini returned invalid JSON: {}",
                    error
                )));
            }
        };
        if !status.is_success() {
            let message = payload
                .get("error")
                .and_then(|value| value.get("message"))
                .and_then(Value::as_str)
                .unwrap_or("The Gemini API returned an error")
                .to_string();
            return Err(AppError::Gemini {
                status: status.as_u16(),
                message,
            });
        }
        Ok(payload)
    }
}

impl crate::ai::provider::MetadataProvider for GeminiMetadataProvider {
    fn provider_name(&self) -> &'static str {
        "gemini"
    }

    fn generate_metadata(
        &self,
        request: &GenerateMetadataRequest,
    ) -> impl std::future::Future<Output = AppResult<MetadataGenerationResult>> + Send {
        self.generate(request)
    }
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

fn is_retryable(error: &AppError) -> bool {
    match error {
        AppError::Gemini { status, .. } => *status == 429 || (500..=599).contains(status),
        AppError::Network(_) => true,
        _ => false,
    }
}

#[derive(Debug, Deserialize)]
struct StructuredOutput {
    assets: Vec<GeneratedMetadata>,
}

fn parse_response(
    request: &GenerateMetadataRequest,
    payload: &Value,
) -> AppResult<MetadataGenerationResult> {
    let text = payload
        .get("candidates")
        .and_then(Value::as_array)
        .and_then(|candidates| candidates.first())
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(Value::as_array)
        .and_then(|parts| parts.iter().find_map(|part| part.get("text")))
        .and_then(Value::as_str)
        .ok_or_else(|| {
            AppError::GeminiResponse("Respons Gemini tidak berisi teks hasil".to_string())
        })?;
    let parsed: StructuredOutput = parse_json_text(text)?;
    let usage = payload
        .get("usageMetadata")
        .cloned()
        .and_then(|value| serde_json::from_value::<GeminiUsageMetadata>(value).ok())
        .unwrap_or_default();
    let expected: HashSet<&str> = request.expected_ids.iter().map(String::as_str).collect();
    let mut seen = HashSet::new();
    let mut warnings = Vec::new();
    let mut assets = Vec::new();

    for asset in parsed.assets {
        if !expected.contains(asset.id.as_str()) {
            warnings.push(format!("Ignored unexpected panel ID {}", asset.id));
            continue;
        }
        if !seen.insert(asset.id.clone()) {
            warnings.push(format!("Ignored duplicate panel ID {}", asset.id));
            continue;
        }
        if !(1..=21).contains(&asset.category) {
            warnings.push(format!("Panel {} returned an invalid category", asset.id));
            continue;
        }
        assets.push(asset);
    }

    let missing_ids = request
        .expected_ids
        .iter()
        .filter(|id| !seen.contains(*id))
        .cloned()
        .collect::<Vec<_>>();
    if assets.is_empty() {
        return Err(AppError::GeminiResponse(
            "Gemini tidak mengembalikan metadata panel yang valid".to_string(),
        ));
    }
    Ok(MetadataGenerationResult {
        batch_id: request.batch_id.clone(),
        assets,
        missing_ids,
        warnings,
        attempts: 1,
        usage,
    })
}

fn parse_json_text(text: &str) -> AppResult<StructuredOutput> {
    match serde_json::from_str::<StructuredOutput>(text.trim()) {
        Ok(parsed) => Ok(parsed),
        Err(first_error) => {
            let cleaned = text
                .trim()
                .strip_prefix("```json")
                .or_else(|| text.trim().strip_prefix("```"))
                .and_then(|value| value.strip_suffix("```"))
                .map(str::trim);
            if let Some(cleaned) = cleaned {
                serde_json::from_str(cleaned).map_err(|error| {
                    AppError::GeminiResponse(format!("Structured JSON could not be parsed: {}", error))
                })
            } else {
                Err(AppError::GeminiResponse(format!(
                    "Structured JSON could not be parsed: {}",
                    first_error
                )))
            }
        }
    }
}
