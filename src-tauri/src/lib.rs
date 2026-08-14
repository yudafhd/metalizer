#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod commands;
mod csv;
mod errors;
mod images;
mod metadata;
mod models;
mod state;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let app_local_data = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path");
            std::fs::create_dir_all(&app_local_data).expect("could not create app local data path");
            let salt_path = app_local_data.join("stronghold-salt.txt");
            if let Ok(cache_dir) = app.path().app_cache_dir() {
                let temp_dir = cache_dir.join("metadata-generator");
                if let Ok(entries) = std::fs::read_dir(&temp_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_file() {
                            let _ = std::fs::remove_file(path);
                        }
                    }
                }
            }
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
            )?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::assets::inspect_assets,
            commands::assets::scan_folder,
            commands::assets::create_contact_sheet,
            commands::ai::generate_metadata,
            commands::ai::cancel_generation,
            commands::ai::set_api_key,
            commands::ai::delete_api_key,
            commands::ai::test_api_key,
            commands::metadata::validate_asset_metadata,
            commands::metadata::calculate_quality_score,
            commands::export::export_csv_file,
            commands::settings::cleanup_temp_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Metalizer - Microstock Metadata");
}
