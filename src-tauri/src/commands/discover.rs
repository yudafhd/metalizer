use serde_json::Value;
use std::time::Duration;
use tauri::command;

const DISCOVER_URL: &str = "https://www.mahes.app/api/v1/discover";

#[command]
pub async fn get_discover() -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("Koneksi Discover gagal disiapkan: {error}"))?;
    let response = client
        .get(DISCOVER_URL)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|error| format!("Discover tidak dapat dihubungi: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Discover mengembalikan status gagal: {error}"))?;
    response
        .json::<Value>()
        .await
        .map_err(|error| format!("Respons Discover tidak valid: {error}"))
}
