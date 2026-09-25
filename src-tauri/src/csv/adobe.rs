use std::fs;
use std::path::{Path, PathBuf};

use csv::WriterBuilder;

use crate::errors::AppResult;
use crate::models::{CsvExportPlatform, CsvExportRequest, CsvExportResult, CsvExportRow};

const MAX_ROWS: usize = 5_000;
const MAX_BYTES: usize = 1_000_000;

pub fn export_csv(request: &CsvExportRequest) -> AppResult<CsvExportResult> {
    if request.rows.is_empty() {
        return Ok(CsvExportResult {
            files: Vec::new(),
            row_count: 0,
        });
    }
    let base_path = PathBuf::from(&request.output_path);
    let mut files = Vec::new();
    let mut chunk = Vec::new();
    let mut chunk_number = 1usize;

    for row in &request.rows {
        if chunk.len() >= MAX_ROWS {
            write_chunk(&base_path, &mut files, &chunk, request.platform, request.include_releases, chunk_number, true)?;
            chunk.clear();
            chunk_number += 1;
        }
        chunk.push(row.clone());
        let rendered = render_chunk(&chunk, request.platform, request.include_releases)?;
        if rendered.len() > MAX_BYTES {
            let last = chunk.pop().expect("chunk has at least one row");
            if chunk.is_empty() {
                return Err(crate::errors::AppError::InvalidRequest(
                    "Satu baris CSV melebihi batas export 1 MB".to_string(),
                ));
            }
            write_chunk(&base_path, &mut files, &chunk, request.platform, request.include_releases, chunk_number, true)?;
            chunk.clear();
            chunk_number += 1;
            chunk.push(last);
            if render_chunk(&chunk, request.platform, request.include_releases)?.len() > MAX_BYTES {
                return Err(crate::errors::AppError::InvalidRequest(
                    "Satu baris CSV melebihi batas export 1 MB".to_string(),
                ));
            }
        }
    }
    if !chunk.is_empty() {
        let split = !files.is_empty();
        write_chunk(&base_path, &mut files, &chunk, request.platform, request.include_releases, chunk_number, split)?;
    }
    Ok(CsvExportResult {
        files,
        row_count: request.rows.len(),
    })
}

fn write_chunk(
    base_path: &Path,
    files: &mut Vec<String>,
    rows: &[CsvExportRow],
    platform: CsvExportPlatform,
    include_releases: bool,
    number: usize,
    split: bool,
) -> AppResult<()> {
    let path = output_path_for(base_path, number, split);
    fs::write(&path, render_chunk(rows, platform, include_releases)?)?;
    files.push(path.to_string_lossy().into_owned());
    Ok(())
}

fn render_chunk(rows: &[CsvExportRow], platform: CsvExportPlatform, include_releases: bool) -> AppResult<Vec<u8>> {
    let mut bytes = Vec::new();
    {
        let mut writer = WriterBuilder::new().has_headers(true).delimiter(if matches!(platform, CsvExportPlatform::Freepik) { b';' } else { b',' }).from_writer(&mut bytes);
        if matches!(platform, CsvExportPlatform::Adobe) && include_releases {
            writer.write_record(["Filename", "Title", "Keywords", "Category", "Releases"])?;
            for row in rows {
                let keywords = row.keywords.join(", ");
                let category = row.category.to_string();
                writer.write_record([
                    row.filename.as_str(),
                    row.title.as_str(),
                    keywords.as_str(),
                    category.as_str(),
                    row.releases.as_deref().unwrap_or(""),
                ])?;
            }
        } else if matches!(platform, CsvExportPlatform::Adobe) {
            writer.write_record(["Filename", "Title", "Keywords", "Category"])?;
            for row in rows {
                let keywords = row.keywords.join(", ");
                let category = row.category.to_string();
                writer.write_record([
                    row.filename.as_str(),
                    row.title.as_str(),
                    keywords.as_str(),
                    category.as_str(),
                ])?;
            }
        } else if matches!(platform, CsvExportPlatform::Shutterstock) {
            writer.write_record(["Filename", "Description", "Keywords", "Categories"])?;
            for row in rows {
                let category = row.shutterstock_category.as_deref().unwrap_or("");
                if category.is_empty() {
                    return Err(crate::errors::AppError::InvalidRequest(format!("Kategori Shutterstock belum dipilih: {}", row.filename)));
                }
                writer.write_record([row.filename.as_str(), row.title.as_str(), &row.keywords.join(", "), category])?;
            }
        } else if matches!(platform, CsvExportPlatform::Pond5) {
            writer.write_record(["OriginalFilename", "Title", "Keywords"])?;
            for row in rows {
                writer.write_record([row.filename.as_str(), row.title.as_str(), &row.keywords.join(", ")])?;
            }
        } else {
            writer.write_record(["File name", "Title", "Keywords"])?;
            for row in rows {
                writer.write_record([row.filename.as_str(), row.title.as_str(), &row.keywords.join(",")])?;
            }
        }
        writer.flush()?;
    }
    Ok(bytes)
}

fn output_path_for(base_path: &Path, number: usize, split: bool) -> PathBuf {
    if !split && number == 1 {
        return base_path.to_path_buf();
    }
    let stem = base_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("metadata");
    let extension = base_path.extension().and_then(|value| value.to_str()).unwrap_or("csv");
    base_path.with_file_name(format!("{}_part_{:03}.{}", stem, number, extension))
}
