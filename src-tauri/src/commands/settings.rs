use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use tauri::{command, AppHandle, Manager};

#[command]
pub fn save_temp_image(app: AppHandle, base64_data: String, filename: String) -> Result<String, String> {
    let cache_root = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("metadata-generator");
    std::fs::create_dir_all(&cache_root).map_err(|error| error.to_string())?;

    let raw_b64 = if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };

    let bytes = STANDARD
        .decode(raw_b64.trim())
        .map_err(|error| format!("Invalid base64 data: {}", error))?;

    let safe_filename = std::path::Path::new(&filename)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("storyboard.jpg");

    let file_path = cache_root.join(safe_filename);
    std::fs::write(&file_path, bytes).map_err(|error| error.to_string())?;

    Ok(file_path.to_string_lossy().into_owned())
}

#[command]
pub fn cleanup_temp_file(app: AppHandle, path: String) -> Result<(), String> {
    let candidate = std::path::PathBuf::from(path);
    let cache_root = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("metadata-generator");
    if candidate.exists() {
        let canonical_root = cache_root
            .canonicalize()
            .map_err(|error| error.to_string())?;
        let canonical_candidate = candidate
            .canonicalize()
            .map_err(|error| error.to_string())?;
        if !canonical_candidate.starts_with(&canonical_root) {
            return Err("Temporary file is outside the application cache".to_string());
        }
        std::fs::remove_file(canonical_candidate).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[command]
pub fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Invalid URL protocol".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}
