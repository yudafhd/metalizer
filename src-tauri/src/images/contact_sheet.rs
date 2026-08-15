use std::fs::{self, File};
use std::path::Path;

use image::imageops::{overlay, resize, FilterType};
use image::{DynamicImage, Rgba, RgbaImage};

use crate::errors::{AppError, AppResult};
use crate::images::preprocess::open_image;
use crate::models::{ContactSheetRequest, ContactSheetResult};

const GAP: u32 = 18;
const HEADER: u32 = 58;

pub fn create_contact_sheet(app_cache_dir: &Path, request: &ContactSheetRequest) -> AppResult<ContactSheetResult> {
    let count = request.assets.len();
    if count == 0 || count > 6 {
        return Err(AppError::InvalidRequest(
            "A contact sheet must contain between 1 and 6 assets".to_string(),
        ));
    }
    if request.max_sheet_size < 512 {
        return Err(AppError::InvalidRequest(
            "maxSheetSize must be at least 512 pixels".to_string(),
        ));
    }

    let (columns, rows) = grid_for_count(count);
    let width = request.max_sheet_size.clamp(1024, 4096);
    let content_height = if rows == 1 { 880 } else { 620 };
    let height = GAP * 2 + rows * (HEADER + content_height) + (rows - 1) * GAP;
    let background = parse_background(&request.background);
    let border = Rgba([198, 204, 209, 255]);
    let ink = Rgba([40, 48, 56, 255]);
    let mut canvas = RgbaImage::from_pixel(width, height, background);
    let cell_width = (width - GAP * (columns + 1)) / columns;

    for (index, asset) in request.assets.iter().enumerate() {
        let image = open_image(Path::new(&asset.path)).map_err(|error| {
            AppError::InvalidRequest(format!("Could not decode {}: {}", asset.filename, error))
        })?;
        let column = index as u32 % columns;
        let row = index as u32 / columns;
        let x = GAP + column * (cell_width + GAP);
        let y = GAP + row * (HEADER + content_height + GAP);

        draw_rect(&mut canvas, x, y, cell_width, HEADER, border);
        draw_rect(&mut canvas, x, y + HEADER, cell_width, content_height, border);
        draw_panel_id(&mut canvas, x + 18, y + 16, &asset.panel_id, ink);

        let resized = contain_image(&image, cell_width.saturating_sub(20), content_height.saturating_sub(20));
        let offset_x = x + (cell_width.saturating_sub(resized.width())) / 2;
        let offset_y = y + HEADER + (content_height.saturating_sub(resized.height())) / 2;
        overlay(&mut canvas, &resized, i64::from(offset_x), i64::from(offset_y));
    }

    fs::create_dir_all(app_cache_dir)?;
    let output_path = app_cache_dir.join(format!("batch-{}.jpg", request.batch_id));
    let mut output = File::create(&output_path)?;
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
        &mut output,
        request.quality.clamp(1, 100),
    );
    encoder.encode_image(&DynamicImage::ImageRgba8(canvas))?;

    Ok(ContactSheetResult {
        batch_id: request.batch_id.clone(),
        path: output_path.to_string_lossy().into_owned(),
        width,
        height,
        assets: request.assets.clone(),
    })
}

fn grid_for_count(count: usize) -> (u32, u32) {
    match count {
        1 => (1, 1),
        2 => (2, 1),
        3 => (3, 1),
        4 => (2, 2),
        5 | 6 => (3, 2),
        _ => unreachable!(),
    }
}

fn contain_image(image: &DynamicImage, max_width: u32, max_height: u32) -> RgbaImage {
    let source_width = image.width().max(1);
    let source_height = image.height().max(1);
    let width_ratio = max_width as f32 / source_width as f32;
    let height_ratio = max_height as f32 / source_height as f32;
    let scale = width_ratio.min(height_ratio).min(1.0);
    let target_width = ((source_width as f32 * scale).round() as u32).max(1);
    let target_height = ((source_height as f32 * scale).round() as u32).max(1);
    resize(&image.to_rgba8(), target_width, target_height, FilterType::Lanczos3)
}

fn parse_background(background: &str) -> Rgba<u8> {
    match background.to_ascii_lowercase().as_str() {
        "white" | "#ffffff" => Rgba([255, 255, 255, 255]),
        "gray" | "grey" | "#eeeeee" => Rgba([238, 238, 238, 255]),
        _ => Rgba([247, 248, 249, 255]),
    }
}

fn draw_rect(canvas: &mut RgbaImage, x: u32, y: u32, width: u32, height: u32, color: Rgba<u8>) {
    if width == 0 || height == 0 {
        return;
    }
    let right = (x + width - 1).min(canvas.width().saturating_sub(1));
    let bottom = (y + height - 1).min(canvas.height().saturating_sub(1));
    for px in x..=right {
        canvas.put_pixel(px, y.min(bottom), color);
        canvas.put_pixel(px, bottom, color);
    }
    for py in y..=bottom {
        canvas.put_pixel(x.min(right), py, color);
        canvas.put_pixel(right, py, color);
    }
}

fn draw_panel_id(canvas: &mut RgbaImage, x: u32, y: u32, value: &str, color: Rgba<u8>) {
    let scale = 4;
    let mut cursor = x;
    for ch in value.chars().take(2) {
        if let Some(glyph) = digit_glyph(ch) {
            for (row, bits) in glyph.iter().enumerate() {
                for column in 0..5 {
                    if bits & (1 << (4 - column)) != 0 {
                        for sy in 0..scale {
                            for sx in 0..scale {
                                let px = cursor + column * scale + sx;
                                let py = y + row as u32 * scale + sy;
                                if px < canvas.width() && py < canvas.height() {
                                    canvas.put_pixel(px, py, color);
                                }
                            }
                        }
                    }
                }
            }
        }
        cursor += 6 * scale;
    }
}

fn digit_glyph(ch: char) -> Option<[u8; 7]> {
    match ch {
        '0' => Some([0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110]),
        '1' => Some([0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110]),
        '2' => Some([0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111]),
        '3' => Some([0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110]),
        '4' => Some([0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010]),
        '5' => Some([0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110]),
        '6' => Some([0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110]),
        '7' => Some([0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000]),
        '8' => Some([0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110]),
        '9' => Some([0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b11100]),
        _ => None,
    }
}
