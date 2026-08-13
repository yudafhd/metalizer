use tauri::command;

use crate::csv::adobe::export_csv;
use crate::errors::command_error;
use crate::models::{CsvExportRequest, CsvExportResult};

#[command]
pub fn export_csv_file(request: CsvExportRequest) -> Result<CsvExportResult, String> {
    export_csv(&request).map_err(command_error)
}
