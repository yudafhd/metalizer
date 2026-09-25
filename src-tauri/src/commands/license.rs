use chrono::{DateTime, Duration as ChronoDuration, Utc};
use guardian_core::{storage::JsonFileStore, LicenseConfig, LicenseManager, LicenseStatus};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration as StdDuration, Instant};
use tauri::{command, AppHandle, Manager};
#[cfg(windows)]
use guardian_core::DeviceProvider;
#[cfg(windows)]
use sha2::{Digest, Sha256};
#[cfg(windows)]
use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};

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

#[cfg(windows)]
#[derive(Clone, Copy)]
struct NativeWindowsDevice;

#[cfg(windows)]
impl DeviceProvider for NativeWindowsDevice {
    fn device_id(&self, namespace: &str) -> String {
        let material = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\Microsoft\Cryptography")
            .and_then(|key| key.get_value::<String, _>("MachineGuid"))
            .ok()
            .filter(|value| !value.trim().is_empty())
            .map(|value| value.trim().to_owned())
            .unwrap_or_else(|| {
                format!(
                    "{}|{}|{}|{}",
                    std::env::var("USERNAME").or_else(|_| std::env::var("USER")).unwrap_or_default(),
                    std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")).unwrap_or_default(),
                    std::env::consts::OS,
                    std::env::consts::ARCH,
                )
            });
        let digest = Sha256::digest(format!("secure-license-core/{namespace}|{material}").as_bytes());
        digest.iter().map(|byte| format!("{byte:02x}")).collect()
    }
}

#[cfg(windows)]
type AppLicenseManager = LicenseManager<JsonFileStore, NativeWindowsDevice>;
#[cfg(not(windows))]
type AppLicenseManager = LicenseManager<JsonFileStore>;

fn manager(app: &AppHandle) -> Result<AppLicenseManager, String> {
    let public_key = public_key();
    if public_key.trim().is_empty() {
        return Err("Public key lisensi belum dikonfigurasi pada build aplikasi.".into());
    }
    let path = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("license.json");
    let product = option_env!("LICENSE_PRODUCT_CODE").unwrap_or("metalizer");
    let config = LicenseConfig::new(product, format!("{product}/v1"), public_key);
    let store = JsonFileStore::new(path);
    #[cfg(windows)]
    { Ok(LicenseManager::with_device_provider(config, store, NativeWindowsDevice)) }
    #[cfg(not(windows))]
    { Ok(LicenseManager::new(config, store)) }
}

#[cfg(all(test, windows))]
#[test]
fn native_windows_device_preserves_existing_license_fingerprint() {
    let namespace = "metalizer/v1";
    assert_eq!(NativeWindowsDevice.device_id(namespace), guardian_core::device::system_device_id(namespace));
}

#[command]
pub async fn license_status(app: AppHandle) -> Result<LicenseStatus, String> {
    tokio::task::spawn_blocking(move || {
        manager(&app).and_then(|value| value.status(trusted_now()).map_err(|e| e.to_string()))
    })
    .await
    .map_err(|error| format!("Pemeriksaan lisensi gagal dijalankan: {error}"))?
}

#[command]
pub async fn activate_license(app: AppHandle, license_code: String, email: String) -> Result<LicenseStatus, String> {
    let email = email.trim().to_string();
    if email.is_empty() || !email.contains('@') {
        return Err("Masukkan email yang valid.".into());
    }
    if license_code.trim().is_empty() {
        return Err("Masukkan kode lisensi.".into());
    }
    tokio::task::spawn_blocking(move || {
        manager(&app)?.activate(license_code.trim(), &email, trusted_now()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|error| format!("Aktivasi lisensi gagal dijalankan: {error}"))?
}

pub fn require_license(app: &AppHandle) -> Result<(), String> {
    manager(app)?.require_valid(trusted_now()).map(|_| ()).map_err(|e| e.to_string())
}
