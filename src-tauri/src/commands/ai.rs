use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::{command, State};

use crate::ai::gemini::GeminiMetadataProvider;
use crate::ai::provider::MetadataProvider;
use crate::errors::command_error;
use crate::models::{ApiStatus, GenerateMetadataRequest, MetadataGenerationResult};
use crate::state::AppState;

#[command]
pub async fn generate_metadata(
    request: GenerateMetadataRequest,
    state: State<'_, AppState>,
) -> Result<MetadataGenerationResult, String> {
    let api_key = state
        .api_key
        .lock()
        .map_err(|_| "Could not access API key state".to_string())?
        .as_ref()
        .map(|value| value.to_string())
        .ok_or_else(|| "Gemini API key belum diatur".to_string())?;
    let cancellation = Arc::new(AtomicBool::new(false));
    tracing::info!(batch_id = %request.batch_id, asset_count = request.expected_ids.len(), "metadata batch started");
    state
        .cancellations
        .lock()
        .map_err(|_| "Could not access cancellation state".to_string())?
        .insert(request.batch_id.clone(), cancellation.clone());
    let provider = GeminiMetadataProvider::new(api_key, cancellation);
    let provider_name = provider.provider_name();
    let result = provider.generate_metadata(&request).await.map_err(command_error);
    if result.is_ok() {
        tracing::info!(batch_id = %request.batch_id, provider = provider_name, "metadata batch completed");
    } else {
        tracing::warn!(batch_id = %request.batch_id, "metadata batch failed");
    }
    if let Ok(mut cancellations) = state.cancellations.lock() {
        cancellations.remove(&request.batch_id);
    }
    result
}

#[command]
pub fn cancel_generation(batch_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let cancellation = state
        .cancellations
        .lock()
        .map_err(|_| "Could not access cancellation state".to_string())?
        .get(&batch_id)
        .cloned();
    if let Some(cancellation) = cancellation {
        cancellation.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[command]
pub fn set_api_key(api_key: String, state: State<'_, AppState>) -> Result<(), String> {
    let value = api_key.trim();
    if value.len() < 10 {
        return Err("Gemini API key terlalu pendek".to_string());
    }
    let mut stored = state
        .api_key
        .lock()
        .map_err(|_| "Could not access API key state".to_string())?;
    *stored = Some(value.to_string().into());
    Ok(())
}

#[command]
pub fn delete_api_key(state: State<'_, AppState>) -> Result<(), String> {
    let mut stored = state
        .api_key
        .lock()
        .map_err(|_| "Could not access API key state".to_string())?;
    *stored = None;
    Ok(())
}

#[command]
pub async fn test_api_key(api_key: Option<String>, state: State<'_, AppState>) -> Result<ApiStatus, String> {
    let key = match api_key.filter(|value| !value.trim().is_empty()) {
        Some(value) => value,
        None => state
            .api_key
            .lock()
            .map_err(|_| "Could not access API key state".to_string())?
            .as_ref()
            .map(|value| value.to_string())
            .ok_or_else(|| "Gemini API key belum diatur".to_string())?,
    };
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get("https://generativelanguage.googleapis.com/v1beta/models")
        .query(&[("key", key.as_str())])
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status();
    if status.is_success() {
        Ok(ApiStatus {
            connected: true,
            status: "connected".to_string(),
            message: None,
        })
    } else if status.as_u16() == 429 {
        Ok(ApiStatus {
            connected: false,
            status: "rateLimited".to_string(),
            message: Some("Batas request Gemini tercapai. Coba lagi nanti.".to_string()),
        })
    } else if status.as_u16() == 400 || status.as_u16() == 401 || status.as_u16() == 403 {
        Ok(ApiStatus {
            connected: false,
            status: "invalid".to_string(),
            message: Some("Gemini menolak API key ini.".to_string()),
        })
    } else {
        Ok(ApiStatus {
            connected: false,
            status: "failed".to_string(),
            message: Some(format!("Koneksi Gemini gagal dengan HTTP {}", status.as_u16())),
        })
    }
}
