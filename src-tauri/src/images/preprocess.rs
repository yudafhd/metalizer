use std::io::Cursor;
use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use image::{DynamicImage, ImageFormat};

use crate::errors::{AppError, AppResult};

pub fn mime_type_for_path(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

pub fn read_dimensions(path: &Path) -> AppResult<(u32, u32)> {
    let image = image::open(path)?;
    Ok((image.width(), image.height()))
}

pub fn preview_data_url(path: &Path) -> AppResult<String> {
    let image = image::open(path)?;
    let preview = image.thumbnail(320, 220).to_rgb8();
    let mut bytes = Vec::new();
    DynamicImage::ImageRgb8(preview)
        .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Jpeg)
        .map_err(AppError::from)?;
    Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(bytes)))
}
