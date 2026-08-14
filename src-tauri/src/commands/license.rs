use chrono::Utc;
use guardian_core::{storage::JsonFileStore, LicenseConfig, LicenseManager, LicenseStatus};
use tauri::{command, AppHandle, Manager};

const PRODUCT_ID: &str = "metalizer";
const DEVICE_NAMESPACE: &str = "metalizer/v1";
fn public_key() -> &'static str {
    option_env!("LICENSE_PUBLIC_KEY").unwrap_or("")
}

fn manager(app: &AppHandle) -> Result<LicenseManager<JsonFileStore>, String> {
    let public_key = public_key();
    if public_key.trim().is_empty() {
        return Err("Public key lisensi belum dikonfigurasi pada build aplikasi.".into());
    }
    let path = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("license.json");
    Ok(LicenseManager::new(LicenseConfig::new(PRODUCT_ID, DEVICE_NAMESPACE, public_key), JsonFileStore::new(path)))
}

#[command]
pub fn license_status(app: AppHandle) -> Result<LicenseStatus, String> {
    manager(&app).and_then(|value| value.status(Utc::now()).map_err(|e| e.to_string()))
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
    manager(&app)?.activate(license_code.trim(), email, Utc::now()).map_err(|e| e.to_string())
}

pub fn require_license(app: &AppHandle) -> Result<(), String> {
    manager(app)?.require_valid(Utc::now()).map(|_| ()).map_err(|e| e.to_string())
}
