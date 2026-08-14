use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{command, AppHandle, Manager};
use uuid::Uuid;

use crate::errors::{command_error, AppError, AppResult};
use crate::images::preprocess::{mime_type_for_path, preview_data_url, read_dimensions};
use crate::models::{AssetDescriptor, FolderImageResult};
use crate::models::{ContactSheetRequest, ContactSheetResult};
use crate::images::contact_sheet::create_contact_sheet as build_contact_sheet;

#[command]
pub async fn inspect_assets(paths: Vec<String>) -> Result<Vec<AssetDescriptor>, String> {
    tokio::task::spawn_blocking(move || inspect_paths(paths))
        .await
        .map_err(|error| error.to_string())?
        .map_err(command_error)
}

#[command]
pub async fn scan_folder(path: String) -> Result<FolderImageResult, String> {
    tokio::task::spawn_blocking(move || scan_folder_sync(path))
        .await
        .map_err(|error| error.to_string())?
        .map_err(command_error)
}

fn scan_folder_sync(path: String) -> AppResult<FolderImageResult> {
    let root = PathBuf::from(path);
    if !root.is_dir() {
        return Err(AppError::InvalidRequest(
            "Folder yang dipilih tidak ada atau bukan folder".to_string(),
        ));
    }
    let mut paths = Vec::new();
    collect_file_paths(&root, &mut paths)?;
    let assets = inspect_paths(paths.iter().map(|path| path.to_string_lossy().into_owned()).collect())
        ?;
    let valid_count = assets.len();
    Ok(FolderImageResult {
        paths: assets.into_iter().map(|asset| asset.path).collect(),
        rejected_count: paths.len().saturating_sub(valid_count),
    })
}

#[command]
pub async fn create_contact_sheet(
    app: AppHandle,
    request: ContactSheetRequest,
) -> Result<ContactSheetResult, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("metadata-generator");
    tokio::task::spawn_blocking(move || build_contact_sheet(&cache_dir, &request))
        .await
        .map_err(|error| error.to_string())?
        .map_err(command_error)
}

fn inspect_paths(paths: Vec<String>) -> AppResult<Vec<AssetDescriptor>> {
    let mut seen = HashSet::new();
    let mut assets = Vec::new();
    for raw_path in paths {
        let path = PathBuf::from(&raw_path);
        let Ok(normalized) = normalize_path(&path) else {
            continue;
        };
        if !seen.insert(normalized.clone()) {
            continue;
        }
        let Some(mime_type) = mime_type_for_path(Path::new(&normalized)) else {
            continue;
        };
        let Ok(metadata) = fs::metadata(&normalized) else {
            continue;
        };
        let Ok((width, height)) = read_dimensions(Path::new(&normalized)) else {
            continue;
        };
        let Ok(preview_url) = preview_data_url(Path::new(&normalized)) else {
            continue;
        };
        let Some(filename) = Path::new(&normalized).file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        assets.push(AssetDescriptor {
            id: Uuid::new_v4().to_string(),
            filename: filename.to_string(),
            path: normalized,
            mime_type: mime_type.to_string(),
            width,
            height,
            file_size: metadata.len(),
            preview_url: Some(preview_url),
        });
    }
    Ok(assets)
}

fn normalize_path(path: &Path) -> AppResult<String> {
    let canonical = path.canonicalize()?;
    Ok(canonical.to_string_lossy().into_owned())
}

fn collect_file_paths(root: &Path, output: &mut Vec<PathBuf>) -> AppResult<()> {
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_file_paths(&path, output)?;
        } else {
            output.push(path);
        }
    }
    Ok(())
}
