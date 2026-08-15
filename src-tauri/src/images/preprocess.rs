use std::fs;
use std::io::Cursor;
use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use image::{DynamicImage, ImageFormat, RgbaImage};
use resvg::{tiny_skia, usvg};

use crate::errors::{AppError, AppResult};

pub fn mime_type_for_path(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        _ => None,
    }
}

pub fn read_dimensions(path: &Path) -> AppResult<(u32, u32)> {
    if is_svg(path) {
        let tree = parse_svg(path)?;
        return Ok((
            svg_dimension(tree.size().width())?,
            svg_dimension(tree.size().height())?,
        ));
    }
    Ok(image::image_dimensions(path)?)
}

pub fn open_image(path: &Path) -> AppResult<DynamicImage> {
    if is_svg(path) {
        return render_svg(path, Some(2048));
    }
    Ok(image::open(path)?)
}

pub fn preview_data_url(path: &Path) -> AppResult<String> {
    let image = open_image(path)?;
    let preview = image.thumbnail(320, 220).to_rgb8();
    let mut bytes = Vec::new();
    DynamicImage::ImageRgb8(preview)
        .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Jpeg)
        .map_err(AppError::from)?;
    Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(bytes)))
}

fn is_svg(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("svg"))
        .unwrap_or(false)
}

fn parse_svg(path: &Path) -> AppResult<usvg::Tree> {
    let data = fs::read(path)?;
    usvg::Tree::from_data(&data, &usvg::Options::default())
        .map_err(|error| AppError::InvalidRequest(format!("SVG tidak valid: {}", error)))
}

fn svg_dimension(value: f32) -> AppResult<u32> {
    if !value.is_finite() || value <= 0.0 {
        return Err(AppError::InvalidRequest(
            "SVG harus memiliki ukuran width dan height yang valid".to_string(),
        ));
    }
    Ok(value.ceil().min(u32::MAX as f32) as u32)
}

fn render_svg(path: &Path, max_dimension: Option<u32>) -> AppResult<DynamicImage> {
    let tree = parse_svg(path)?;
    let source_width = svg_dimension(tree.size().width())?;
    let source_height = svg_dimension(tree.size().height())?;
    let scale = max_dimension
        .filter(|value| *value > 0)
        .map(|value| (value as f32 / source_width.max(source_height) as f32).min(1.0))
        .unwrap_or(1.0);
    let width = ((source_width as f32 * scale).round() as u32).max(1);
    let height = ((source_height as f32 * scale).round() as u32).max(1);
    let mut pixmap = tiny_skia::Pixmap::new(width, height)
        .ok_or_else(|| AppError::InvalidRequest("SVG terlalu besar untuk dirender".to_string()))?;
    resvg::render(
        &tree,
        tiny_skia::Transform::from_scale(
            width as f32 / source_width as f32,
            height as f32 / source_height as f32,
        ),
        &mut pixmap.as_mut(),
    );
    let pixels = pixmap.data().to_vec();
    let image = RgbaImage::from_raw(width, height, pixels).ok_or_else(|| {
        AppError::InvalidRequest("Hasil render SVG tidak dapat dibaca".to_string())
    })?;
    Ok(DynamicImage::ImageRgba8(image))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn svg_dimensions_and_rendering_work() {
        let path =
            std::env::temp_dir().join(format!("metalizer-svg-test-{}.svg", std::process::id()));
        let source = br##"<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="#2563eb"/></svg>"##;
        fs::write(&path, source).expect("write SVG fixture");

        assert_eq!(mime_type_for_path(&path), Some("image/svg+xml"));
        assert_eq!(
            read_dimensions(&path).expect("read SVG dimensions"),
            (120, 80)
        );
        let image = open_image(&path).expect("render SVG");
        assert_eq!((image.width(), image.height()), (120, 80));

        fs::remove_file(path).expect("remove SVG fixture");
    }
}
