use tauri::{command, AppHandle, Manager};

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
