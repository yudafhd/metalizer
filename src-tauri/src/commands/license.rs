use chrono::{DateTime, Duration as ChronoDuration, Utc};
use guardian_core::{storage::JsonFileStore, LicenseConfig, LicenseManager, LicenseStatus};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration as StdDuration, Instant};
use tauri::{command, AppHandle, Manager};

const TIME_NOW_URL: &str = "https://time.now/developer/api/timezone/Asia/Jakarta";
const TIME_NOW_TIMEZONE: &str = "Asia/Jakarta";
const TIME_NOW_REFRESH: StdDuration = StdDuration::from_secs(5 * 60);
const TIME_NOW_TIMEOUT: StdDuration = StdDuration::from_secs(3);

#[derive(Debug, Deserialize)]
struct TimeNowResponse { timezone: String, utc_datetime: String }

#[derive(Clone, Copy)]
struct ClockSnapshot { utc: DateTime<Utc>, captured_at: Instant, checked_at: Instant }

static TIME_NOW_CACHE: OnceLock<Mutex<Option<ClockSnapshot>>> = OnceLock::new();

fn time_now_cache() -> &'static Mutex<Option<ClockSnapshot>> {
    TIME_NOW_CACHE.get_or_init(|| Mutex::new(None))
}

fn add_elapsed(utc: DateTime<Utc>, elapsed: StdDuration) -> DateTime<Utc> {
    utc + ChronoDuration::milliseconds(i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX))
}

fn trusted_now() -> DateTime<Utc> {
    let cached = time_now_cache().lock().ok().and_then(|cache| *cache);
    if let Some(snapshot) = cached {
        if snapshot.checked_at.elapsed() < TIME_NOW_REFRESH {
            return add_elapsed(snapshot.utc, snapshot.captured_at.elapsed());
        }
    }

    let fetched = Client::builder().timeout(TIME_NOW_TIMEOUT).build()
        .ok()
        .and_then(|client| client.get(TIME_NOW_URL).header("Accept", "application/json").send().ok())
        .filter(|response| response.status().is_success())
        .and_then(|response| response.json::<TimeNowResponse>().ok())
        .filter(|payload| payload.timezone == TIME_NOW_TIMEZONE)
        .and_then(|payload| DateTime::parse_from_rfc3339(&payload.utc_datetime).ok())
        .map(|value| value.with_timezone(&Utc));

    if let Some(utc) = fetched {
        let captured_at = Instant::now();
        if let Ok(mut cache) = time_now_cache().lock() {
            *cache = Some(ClockSnapshot { utc, captured_at, checked_at: captured_at });
        }
        return utc;
    }
    if let Some(snapshot) = cached { return add_elapsed(snapshot.utc, snapshot.captured_at.elapsed()); }
    Utc::now()
}

fn public_key() -> &'static str {
    option_env!("LICENSE_PUBLIC_KEY").unwrap_or("")
}

fn manager(app: &AppHandle) -> Result<LicenseManager<JsonFileStore>, String> {
    let public_key = public_key();
    if public_key.trim().is_empty() {
        return Err("Public key lisensi belum dikonfigurasi pada build aplikasi.".into());
    }
    let path = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("license.json");
    let product = option_env!("LICENSE_PRODUCT_CODE").unwrap_or("metalizer");
    Ok(LicenseManager::new(LicenseConfig::new(product, format!("{product}/v1"), public_key), JsonFileStore::new(path)))
}

#[command]
pub fn license_status(app: AppHandle) -> Result<LicenseStatus, String> {
    manager(&app).and_then(|value| value.status(trusted_now()).map_err(|e| e.to_string()))
}

#[command]
pub fn activate_license(app: AppHandle, license_code: String, email: String) -> Result<LicenseStatus, String> {
    let email = email.trim();
    if email.is_empty() || !email.contains('@') {
        return Err("Masukkan email yang valid.".into());
    }
    if license_code.trim().is_empty() {
        return Err("Masukkan kode lisensi.".into());
    }
    manager(&app)?.activate(license_code.trim(), email, trusted_now()).map_err(|e| e.to_string())
}

pub fn require_license(app: &AppHandle) -> Result<(), String> {
    manager(app)?.require_valid(trusted_now()).map(|_| ()).map_err(|e| e.to_string())
}
