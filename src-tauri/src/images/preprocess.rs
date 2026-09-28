use std::fs;
use std::io::Cursor;
use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use image::{DynamicImage, ImageFormat, RgbaImage};
use resvg::{tiny_skia, usvg};

use crate::errors::{AppError, AppResult};

pub fn is_video(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|ext| ext.to_str()) else {
        return false;
    };
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "mp4" | "mov" | "webm" | "m4v"
    )
}

pub fn mime_type_for_path(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        "eps" => Some("application/postscript"),
        "mp4" | "m4v" => Some("video/mp4"),
        "mov" => Some("video/quicktime"),
        "webm" => Some("video/webm"),
        _ => None,
    }
}

pub fn read_dimensions(path: &Path) -> AppResult<(u32, u32)> {
    if is_video(path) {
        return Ok((0, 0));
    }
    if is_svg(path) {
        let tree = parse_svg(path)?;
        return Ok((
            svg_dimension(tree.size().width())?,
            svg_dimension(tree.size().height())?,
        ));
    }
    if is_eps(path) {
        return read_eps_dimensions(path);
    }
    Ok(image::image_dimensions(path)?)
}

pub fn open_image(path: &Path) -> AppResult<DynamicImage> {
    if is_svg(path) {
        return render_svg(path, Some(2048));
    }
    if is_eps(path) {
        return render_eps(path);
    }
    Ok(image::open(path)?)
}

pub fn preview_data_url(path: &Path) -> AppResult<String> {
    if is_video(path) {
        return Err(AppError::InvalidRequest("Video preview is generated on frontend".to_string()));
    }
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

fn is_eps(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("eps"))
        .unwrap_or(false)
}

fn render_eps(path: &Path) -> AppResult<DynamicImage> {
    let data = fs::read(path)?;
    extract_eps_preview(&data)
}

fn read_eps_dimensions(path: &Path) -> AppResult<(u32, u32)> {
    let data = fs::read(path)?;

    // Tentukan segmen PostScript jika menggunakan header biner DOS EPS
    let ps_slice = if data.len() >= 30 && data[0..4] == [0xC5, 0xD0, 0xD3, 0xC6] {
        let ps_start = u32::from_le_bytes(data[4..8].try_into().unwrap()) as usize;
        let ps_len = u32::from_le_bytes(data[8..12].try_into().unwrap()) as usize;
        if ps_start < data.len() {
            let ps_end = (ps_start + ps_len).min(data.len());
            &data[ps_start..ps_end]
        } else {
            &data[..]
        }
    } else {
        &data[..]
    };

    if let Some(dimensions) = parse_eps_bounding_box(ps_slice) {
        return Ok(dimensions);
    }

    // Fallback: gunakan ukuran dari preview image yang diekstrak
    let preview = extract_eps_preview(&data)?;
    Ok((preview.width(), preview.height()))
}

#[derive(Clone, Copy)]
struct EpsBounds {
    llx: f32,
    lly: f32,
    urx: f32,
    ury: f32,
}

impl EpsBounds {
    fn dimensions(self) -> (u32, u32) {
        (
            (self.urx - self.llx).round() as u32,
            (self.ury - self.lly).round() as u32,
        )
    }
}

fn parse_eps_bounding_box(ps_data: &[u8]) -> Option<(u32, u32)> {
    parse_eps_bounds(ps_data).map(EpsBounds::dimensions)
}

fn parse_eps_bounds(ps_data: &[u8]) -> Option<EpsBounds> {
    let check_chunk = |chunk: &[u8]| -> Option<EpsBounds> {
        let text = String::from_utf8_lossy(chunk);
        let mut best: Option<EpsBounds> = None;

        for line in text.lines() {
            let trimmed = line.trim();
            let (is_hires, raw_params) = if let Some(rest) = trimmed.strip_prefix("%%HiResBoundingBox:") {
                (true, rest)
            } else if let Some(rest) = trimmed.strip_prefix("%%BoundingBox:") {
                (false, rest)
            } else {
                continue;
            };

            let parts: Vec<&str> = raw_params.split_whitespace().collect();
            if parts.len() < 4 || parts[0].eq_ignore_ascii_case("(atend)") {
                continue;
            }

            let parse_num = |s: &str| -> Option<f32> { s.parse::<f32>().ok() };
            if let (Some(llx), Some(lly), Some(urx), Some(ury)) = (
                parse_num(parts[0]),
                parse_num(parts[1]),
                parse_num(parts[2]),
                parse_num(parts[3]),
            ) {
                if llx.is_finite() && lly.is_finite() && urx.is_finite() && ury.is_finite()
                    && urx > llx && ury > lly
                    && (urx - llx).round() >= 1.0 && (ury - lly).round() >= 1.0
                {
                    let bounds = EpsBounds { llx, lly, urx, ury };
                    if is_hires {
                        return Some(bounds);
                    }
                    best = Some(bounds);
                }
            }
        }
        best
    };

    let head_limit = ps_data.len().min(16384);
    if let Some(dim) = check_chunk(&ps_data[..head_limit]) {
        return Some(dim);
    }

    if ps_data.len() > 16384 {
        let tail_start = ps_data.len().saturating_sub(16384);
        if let Some(dim) = check_chunk(&ps_data[tail_start..]) {
            return Some(dim);
        }
    }

    None
}

fn extract_eps_preview(data: &[u8]) -> AppResult<DynamicImage> {
    // 1. Coba baca DOS EPS Binary Header (Embedded TIFF Preview)
    if data.len() >= 30 && data[0..4] == [0xC5, 0xD0, 0xD3, 0xC6] {
        let tiff_offset = u32::from_le_bytes(data[20..24].try_into().unwrap()) as usize;
        let tiff_len = u32::from_le_bytes(data[24..28].try_into().unwrap()) as usize;

        if tiff_len > 0 && tiff_offset + tiff_len <= data.len() {
            let tiff_data = &data[tiff_offset..tiff_offset + tiff_len];
            if let Ok(image) = image::load_from_memory_with_format(tiff_data, ImageFormat::Tiff) {
                return Ok(image);
            }
            if let Some(image) = decode_uncompressed_palette_tiff(tiff_data) {
                return Ok(image);
            }
        }
    }

    // 2. Coba cari XMP Embedded Thumbnail (Base64 JPEG)
    if let Some(image) = extract_xmp_thumbnail(data) {
        return Ok(image);
    }

    // 3. Coba cari %%BeginPreview: ... %%EndPreview (EPSI format)
    if let Some(image) = extract_epsi_preview(data) {
        return Ok(image);
    }

    // 4. Fallback: render instruksi path vektor PostScript (seperti file dari Canvas Vector Recorder)
    if !is_adobe_illustrator_file(data) {
        if let Some(bounds) = parse_eps_bounds(data) {
            if let Some(svg_data) = convert_eps_to_svg_data(data, bounds) {
                if let Ok(tree) = usvg::Tree::from_data(&svg_data, &usvg::Options::default()) {
                    if let Ok(image) = render_usvg_tree(&tree, Some(2048)) {
                        return Ok(image);
                    }
                }
            }
        }
    }

    Err(AppError::InvalidRequest(
        "File EPS tidak memiliki embedded preview (TIFF atau XMP) dan tidak dapat dirender secara vektor. Pastikan opsi preview (TIFF 8-bit) diaktifkan saat menyimpan file EPS di Adobe Illustrator.".to_string(),
    ))
}

fn is_adobe_illustrator_file(data: &[u8]) -> bool {
    let head_limit = data.len().min(8192);
    let head = &data[..head_limit];
    find_subsequence(head, b"Adobe Illustrator").is_some()
        || find_subsequence(head, b"%%AI8_CreatorVersion:").is_some()
        || find_subsequence(head, b"%%AI9_PrintingDataBegin").is_some()
}

fn extract_xmp_thumbnail(data: &[u8]) -> Option<DynamicImage> {
    let tag_pairs: [(&[u8], &[u8]); 2] = [
        (b"<xmpGImg:image>", b"</xmpGImg:image>"),
        (b"<xapGImg:image>", b"</xapGImg:image>"),
    ];

    for (start_tag, end_tag) in tag_pairs {
        if let Some(start_pos) = find_subsequence(data, start_tag) {
            let content_start = start_pos + start_tag.len();
            if let Some(end_rel) = find_subsequence(&data[content_start..], end_tag) {
                let content_end = content_start + end_rel;
                let raw_b64 = &data[content_start..content_end];
                let text = String::from_utf8_lossy(raw_b64);
                let stripped = text
                    .replace("&#xA;", "")
                    .replace("&#xa;", "")
                    .replace("&#xD;", "")
                    .replace("&#xd;", "")
                    .replace("&#10;", "")
                    .replace("&#13;", "");
                let cleaned: Vec<u8> = stripped
                    .bytes()
                    .filter(|byte| !byte.is_ascii_whitespace())
                    .collect();
                if let Ok(jpeg_bytes) = STANDARD.decode(&cleaned) {
                    if let Ok(img) = image::load_from_memory_with_format(&jpeg_bytes, ImageFormat::Jpeg) {
                        return Some(img);
                    }
                }
            }
        }
    }
    None
}

fn decode_uncompressed_palette_tiff(data: &[u8]) -> Option<DynamicImage> {
    if data.len() < 8 {
        return None;
    }
    let is_le = match &data[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => return None,
    };

    let read_u16 = |buf: &[u8], offset: usize| -> Option<u16> {
        let slice = buf.get(offset..offset + 2)?;
        Some(if is_le {
            u16::from_le_bytes(slice.try_into().unwrap())
        } else {
            u16::from_be_bytes(slice.try_into().unwrap())
        })
    };

    let read_u32 = |buf: &[u8], offset: usize| -> Option<u32> {
        let slice = buf.get(offset..offset + 4)?;
        Some(if is_le {
            u32::from_le_bytes(slice.try_into().unwrap())
        } else {
            u32::from_be_bytes(slice.try_into().unwrap())
        })
    };

    let version = read_u16(data, 2)?;
    if version != 42 {
        return None;
    }

    let ifd_offset = read_u32(data, 4)? as usize;
    let num_entries = read_u16(data, ifd_offset)? as usize;

    let mut width: Option<u32> = None;
    let mut height: Option<u32> = None;
    let mut compression = 1u16;
    let mut photometric = 0u16;
    let mut samples_per_pixel = 1u16;
    let mut strip_offsets = Vec::new();
    let mut strip_byte_counts = Vec::new();
    let mut colormap_offset: Option<usize> = None;
    let mut colormap_count: usize = 0;

    for i in 0..num_entries {
        let entry_offset = ifd_offset + 2 + i * 12;
        let tag = read_u16(data, entry_offset)?;
        let typ = read_u16(data, entry_offset + 2)?;
        let count = read_u32(data, entry_offset + 4)? as usize;
        let val_or_offset = read_u32(data, entry_offset + 8)?;

        match tag {
            256 => width = Some(if typ == 3 { val_or_offset & 0xFFFF } else { val_or_offset }),
            257 => height = Some(if typ == 3 { val_or_offset & 0xFFFF } else { val_or_offset }),
            259 => compression = (val_or_offset & 0xFFFF) as u16,
            262 => photometric = (val_or_offset & 0xFFFF) as u16,
            277 => samples_per_pixel = (val_or_offset & 0xFFFF) as u16,
            273 => {
                if count == 1 {
                    strip_offsets.push(val_or_offset as usize);
                } else {
                    let off = val_or_offset as usize;
                    for j in 0..count {
                        if typ == 3 {
                            if let Some(val) = read_u16(data, off + j * 2) {
                                strip_offsets.push(val as usize);
                            }
                        } else if let Some(val) = read_u32(data, off + j * 4) {
                            strip_offsets.push(val as usize);
                        }
                    }
                }
            }
            279 => {
                if count == 1 {
                    strip_byte_counts.push(val_or_offset as usize);
                } else {
                    let off = val_or_offset as usize;
                    for j in 0..count {
                        if typ == 3 {
                            if let Some(val) = read_u16(data, off + j * 2) {
                                strip_byte_counts.push(val as usize);
                            }
                        } else if let Some(val) = read_u32(data, off + j * 4) {
                            strip_byte_counts.push(val as usize);
                        }
                    }
                }
            }
            320 => {
                colormap_offset = Some(val_or_offset as usize);
                colormap_count = count;
            }
            _ => {}
        }
    }

    let width = width?;
    let height = height?;

    if compression != 1 || photometric != 3 || colormap_count < 768 {
        return None;
    }
    let colormap_off = colormap_offset?;

    let mut red_map = [0u8; 256];
    let mut green_map = [0u8; 256];
    let mut blue_map = [0u8; 256];

    for idx in 0..256 {
        red_map[idx] = (read_u16(data, colormap_off + idx * 2)? >> 8) as u8;
        green_map[idx] = (read_u16(data, colormap_off + (256 + idx) * 2)? >> 8) as u8;
        blue_map[idx] = (read_u16(data, colormap_off + (512 + idx) * 2)? >> 8) as u8;
    }

    let total_pixels = (width as usize) * (height as usize);
    let mut rgba = Vec::with_capacity(total_pixels * 4);

    let spp = samples_per_pixel as usize;
    if spp != 1 && spp != 2 {
        return None;
    }

    let mut pixels_written = 0;
    for (&strip_off, &strip_len) in strip_offsets.iter().zip(strip_byte_counts.iter()) {
        let strip_data = data.get(strip_off..strip_off + strip_len)?;
        let mut i = 0;
        while i + spp <= strip_data.len() && pixels_written < total_pixels {
            let palette_idx = strip_data[i] as usize;
            let alpha = if spp == 2 { strip_data[i + 1] } else { 255u8 };

            rgba.push(red_map[palette_idx]);
            rgba.push(green_map[palette_idx]);
            rgba.push(blue_map[palette_idx]);
            rgba.push(alpha);

            pixels_written += 1;
            i += spp;
        }
    }

    if pixels_written == total_pixels {
        let img = RgbaImage::from_raw(width, height, rgba)?;
        Some(DynamicImage::ImageRgba8(img))
    } else {
        None
    }
}

fn extract_epsi_preview(data: &[u8]) -> Option<DynamicImage> {
    let marker = b"%%BeginPreview:";
    let start_pos = find_subsequence(data, marker)?;
    let end_marker = b"%%EndPreview";
    let end_pos = find_subsequence(&data[start_pos..], end_marker)? + start_pos;
    let preview_slice = &data[start_pos..end_pos];

    let text = String::from_utf8_lossy(preview_slice);
    let mut lines = text.lines();
    let header_line = lines.next()?;
    let params: Vec<&str> = header_line
        .strip_prefix("%%BeginPreview:")?
        .split_whitespace()
        .collect();
    if params.len() < 3 {
        return None;
    }
    let width: u32 = params[0].parse().ok()?;
    let height: u32 = params[1].parse().ok()?;
    let depth: u32 = params[2].parse().ok()?;
    if width == 0 || height == 0 || (depth != 1 && depth != 8) {
        return None;
    }

    let mut hex_chars = Vec::new();
    for line in lines {
        let trimmed = line.trim();
        let stripped = trimmed.strip_prefix('%').unwrap_or(trimmed).trim();
        for ch in stripped.chars() {
            if ch.is_ascii_hexdigit() {
                hex_chars.push(ch as u8);
            }
        }
    }

    if depth == 8 {
        let mut pixels = Vec::with_capacity((width * height) as usize);
        for chunk in hex_chars.chunks_exact(2) {
            let hex_str = std::str::from_utf8(chunk).ok()?;
            let val = u8::from_str_radix(hex_str, 16).ok()?;
            pixels.push(val);
            if pixels.len() == (width * height) as usize {
                break;
            }
        }
        if pixels.len() == (width * height) as usize {
            let img = image::GrayImage::from_raw(width, height, pixels)?;
            return Some(DynamicImage::ImageLuma8(img));
        }
    } else if depth == 1 {
        let mut pixels = Vec::with_capacity((width * height) as usize);
        'outer: for ch in hex_chars {
            let val = (ch as char).to_digit(16)? as u8;
            for shift in (0..4).rev() {
                let bit = (val >> shift) & 1;
                let pixel = if bit == 1 { 0u8 } else { 255u8 };
                pixels.push(pixel);
                if pixels.len() == (width * height) as usize {
                    break 'outer;
                }
            }
        }
        if pixels.len() == (width * height) as usize {
            let img = image::GrayImage::from_raw(width, height, pixels)?;
            return Some(DynamicImage::ImageLuma8(img));
        }
    }

    None
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

struct GState {
    color: String,
    line_width: f32,
    opened_tags: usize,
}

fn convert_eps_to_svg_data(data: &[u8], bounds: EpsBounds) -> Option<Vec<u8>> {
    let text = String::from_utf8_lossy(data);
    let mut tokens = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('%') || trimmed.is_empty() {
            continue;
        }
        for word in trimmed.split_whitespace() {
            let mut current = String::new();
            for ch in word.chars() {
                if ch == '[' || ch == ']' {
                    if !current.is_empty() {
                        tokens.push(std::mem::take(&mut current));
                    }
                    tokens.push(ch.to_string());
                } else {
                    current.push(ch);
                }
            }
            if !current.is_empty() {
                tokens.push(current);
            }
        }
    }

    if tokens.is_empty() {
        return None;
    }

    let (width, height) = bounds.dimensions();
    let mut svg = String::with_capacity(data.len());
    // PostScript uses a bottom-left origin; SVG uses a top-left origin.
    svg.push_str(&format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" width="{}" height="{}"><g transform="translate({} {}) scale(1 -1)">"#,
        width, height, width, height, -bounds.llx, bounds.ury
    ));

    let mut stack: Vec<String> = Vec::new();
    let mut current_path = String::new();
    let mut color = "rgb(0,0,0)".to_string();
    let mut line_width = 1.0f32;
    let mut g_stack: Vec<GState> = Vec::new();
    let mut root_opened_tags = 0usize;
    let mut operations_count = 0usize;

    for tok in tokens {
        match tok.as_str() {
            "save" | "restore" | "showpage" | "[" | "]" => {}
            "newpath" => {
                current_path.clear();
            }
            "gsave" => {
                g_stack.push(GState {
                    color: color.clone(),
                    line_width,
                    opened_tags: 0,
                });
            }
            "grestore" => {
                if let Some(state) = g_stack.pop() {
                    color = state.color;
                    line_width = state.line_width;
                    for _ in 0..state.opened_tags {
                        svg.push_str("</g>");
                    }
                }
            }
            "translate" => {
                if stack.len() >= 2 {
                    let ty = stack.pop().unwrap();
                    let tx = stack.pop().unwrap();
                    svg.push_str(&format!(r#"<g transform="translate({}, {})">"#, tx, ty));
                    if let Some(last) = g_stack.last_mut() {
                        last.opened_tags += 1;
                    } else {
                        root_opened_tags += 1;
                    }
                }
            }
            "scale" => {
                if stack.len() >= 2 {
                    let sy = stack.pop().unwrap();
                    let sx = stack.pop().unwrap();
                    svg.push_str(&format!(r#"<g transform="scale({}, {})">"#, sx, sy));
                    if let Some(last) = g_stack.last_mut() {
                        last.opened_tags += 1;
                    } else {
                        root_opened_tags += 1;
                    }
                }
            }
            "concat" => {
                if stack.len() >= 6 {
                    let f = stack.pop().unwrap();
                    let e = stack.pop().unwrap();
                    let d = stack.pop().unwrap();
                    let c = stack.pop().unwrap();
                    let b = stack.pop().unwrap();
                    let a = stack.pop().unwrap();
                    svg.push_str(&format!(r#"<g transform="matrix({} {} {} {} {} {})">"#, a, b, c, d, e, f));
                    if let Some(last) = g_stack.last_mut() {
                        last.opened_tags += 1;
                    } else {
                        root_opened_tags += 1;
                    }
                }
            }
            "setrgbcolor" => {
                if stack.len() >= 3 {
                    let b: f32 = stack.pop().unwrap().parse().unwrap_or(0.0);
                    let g: f32 = stack.pop().unwrap().parse().unwrap_or(0.0);
                    let r: f32 = stack.pop().unwrap().parse().unwrap_or(0.0);
                    color = format!(
                        "rgb({},{},{})",
                        (r * 255.0).round().clamp(0.0, 255.0) as u8,
                        (g * 255.0).round().clamp(0.0, 255.0) as u8,
                        (b * 255.0).round().clamp(0.0, 255.0) as u8
                    );
                }
            }
            "setgray" => {
                if let Some(g_val) = stack.pop().and_then(|v| v.parse::<f32>().ok()) {
                    let gray = (g_val * 255.0).round().clamp(0.0, 255.0) as u8;
                    color = format!("rgb({},{},{})", gray, gray, gray);
                }
            }
            "setcmykcolor" => {
                if stack.len() >= 4 {
                    let k: f32 = stack.pop().unwrap().parse().unwrap_or(0.0);
                    let y: f32 = stack.pop().unwrap().parse().unwrap_or(0.0);
                    let m: f32 = stack.pop().unwrap().parse().unwrap_or(0.0);
                    let c: f32 = stack.pop().unwrap().parse().unwrap_or(0.0);
                    let r = ((1.0 - c) * (1.0 - k) * 255.0).round().clamp(0.0, 255.0) as u8;
                    let g = ((1.0 - m) * (1.0 - k) * 255.0).round().clamp(0.0, 255.0) as u8;
                    let b = ((1.0 - y) * (1.0 - k) * 255.0).round().clamp(0.0, 255.0) as u8;
                    color = format!("rgb({},{},{})", r, g, b);
                }
            }
            "setlinewidth" => {
                if let Some(w) = stack.pop().and_then(|v| v.parse::<f32>().ok()) {
                    line_width = w;
                }
            }
            "moveto" => {
                if stack.len() >= 2 {
                    let y = stack.pop().unwrap();
                    let x = stack.pop().unwrap();
                    current_path.push_str(&format!("M {} {} ", x, y));
                }
            }
            "lineto" => {
                if stack.len() >= 2 {
                    let y = stack.pop().unwrap();
                    let x = stack.pop().unwrap();
                    current_path.push_str(&format!("L {} {} ", x, y));
                }
            }
            "curveto" => {
                if stack.len() >= 6 {
                    let y3 = stack.pop().unwrap();
                    let x3 = stack.pop().unwrap();
                    let y2 = stack.pop().unwrap();
                    let x2 = stack.pop().unwrap();
                    let y1 = stack.pop().unwrap();
                    let x1 = stack.pop().unwrap();
                    current_path.push_str(&format!("C {} {} {} {} {} {} ", x1, y1, x2, y2, x3, y3));
                }
            }
            "closepath" => {
                current_path.push_str("Z ");
            }
            "fill" => {
                if !current_path.is_empty() {
                    svg.push_str(&format!(
                        r#"<path d="{}" fill="{}" stroke="none"/>"#,
                        current_path.trim_end(),
                        color
                    ));
                    operations_count += 1;
                }
            }
            "stroke" => {
                if !current_path.is_empty() {
                    svg.push_str(&format!(
                        r#"<path d="{}" fill="none" stroke="{}" stroke-width="{}"/>"#,
                        current_path.trim_end(),
                        color,
                        line_width
                    ));
                    operations_count += 1;
                }
            }
            other => {
                stack.push(other.to_string());
            }
        }
    }

    if operations_count == 0 {
        return None;
    }

    while let Some(state) = g_stack.pop() {
        for _ in 0..state.opened_tags {
            svg.push_str("</g>");
        }
    }
    for _ in 0..root_opened_tags {
        svg.push_str("</g>");
    }
    svg.push_str("</g></svg>");

    Some(svg.into_bytes())
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

fn render_usvg_tree(tree: &usvg::Tree, max_dimension: Option<u32>) -> AppResult<DynamicImage> {
    let source_width = svg_dimension(tree.size().width())?;
    let source_height = svg_dimension(tree.size().height())?;
    let scale = max_dimension
        .filter(|value| *value > 0)
        .map(|value| (value as f32 / source_width.max(source_height) as f32).min(1.0))
        .unwrap_or(1.0);
    let width = ((source_width as f32 * scale).round() as u32).max(1);
    let height = ((source_height as f32 * scale).round() as u32).max(1);
    let mut pixmap = tiny_skia::Pixmap::new(width, height)
        .ok_or_else(|| AppError::InvalidRequest("Vektor terlalu besar untuk dirender".to_string()))?;
    resvg::render(
        tree,
        tiny_skia::Transform::from_scale(
            width as f32 / source_width as f32,
            height as f32 / source_height as f32,
        ),
        &mut pixmap.as_mut(),
    );
    let pixels = pixmap.data().to_vec();
    let image = RgbaImage::from_raw(width, height, pixels).ok_or_else(|| {
        AppError::InvalidRequest("Hasil render vektor tidak dapat dibaca".to_string())
    })?;
    Ok(DynamicImage::ImageRgba8(image))
}

fn render_svg(path: &Path, max_dimension: Option<u32>) -> AppResult<DynamicImage> {
    let tree = parse_svg(path)?;
    render_usvg_tree(&tree, max_dimension)
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

    #[test]
    fn eps_with_dos_header_tiff_preview_works() {
        let path = std::env::temp_dir().join(format!("metalizer-eps-tiff-test-{}.eps", std::process::id()));

        // Create a 10x10 test TIFF image
        let tiff_img = DynamicImage::ImageRgb8(image::RgbImage::new(10, 10));
        let mut tiff_bytes = Vec::new();
        tiff_img.write_to(&mut Cursor::new(&mut tiff_bytes), ImageFormat::Tiff).expect("encode test TIFF");

        let ps_code = b"%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 600 400\n%%HiResBoundingBox: 0.0 0.0 600.0 400.0\n%%Title: Test\n";
        
        let header_len = 30;
        let ps_start = header_len as u32;
        let ps_len = ps_code.len() as u32;
        let tiff_start = ps_start + ps_len;
        let tiff_len = tiff_bytes.len() as u32;

        let mut file_bytes = Vec::new();
        // Magic
        file_bytes.extend_from_slice(&[0xC5, 0xD0, 0xD3, 0xC6]);
        // PS start & len
        file_bytes.extend_from_slice(&ps_start.to_le_bytes());
        file_bytes.extend_from_slice(&ps_len.to_le_bytes());
        // Metafile start & len (0)
        file_bytes.extend_from_slice(&0u32.to_le_bytes());
        file_bytes.extend_from_slice(&0u32.to_le_bytes());
        // TIFF start & len
        file_bytes.extend_from_slice(&tiff_start.to_le_bytes());
        file_bytes.extend_from_slice(&tiff_len.to_le_bytes());
        // Checksum
        file_bytes.extend_from_slice(&0xFFFFu16.to_le_bytes());

        // Body
        file_bytes.extend_from_slice(ps_code);
        file_bytes.extend_from_slice(&tiff_bytes);

        fs::write(&path, file_bytes).expect("write EPS fixture");

        assert_eq!(mime_type_for_path(&path), Some("application/postscript"));
        assert_eq!(read_dimensions(&path).expect("read EPS dimensions"), (600, 400));
        let image = open_image(&path).expect("read EPS preview");
        assert_eq!((image.width(), image.height()), (10, 10));

        let data_url = preview_data_url(&path).expect("generate preview data url");
        assert!(data_url.starts_with("data:image/jpeg;base64,"));

        fs::remove_file(path).expect("remove EPS fixture");
    }

    #[test]
    fn eps_with_xmp_jpeg_preview_works() {
        let path = std::env::temp_dir().join(format!("metalizer-eps-xmp-test-{}.eps", std::process::id()));

        // Create a 16x16 test JPEG
        let jpeg_img = DynamicImage::ImageRgb8(image::RgbImage::new(16, 16));
        let mut jpeg_bytes = Vec::new();
        jpeg_img.write_to(&mut Cursor::new(&mut jpeg_bytes), ImageFormat::Jpeg).expect("encode test JPEG");
        let b64 = STANDARD.encode(&jpeg_bytes);

        let eps_content = format!(
            "%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 1024 768\n<?xpacket begin=\"﻿\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?>\n<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">\n<rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n<xmpGImg:image>\n{}\n</xmpGImg:image>\n</rdf:RDF>\n</x:xmpmeta>\n<?xpacket end=\"w\"?>\n",
            b64
        );

        fs::write(&path, eps_content.as_bytes()).expect("write EPS XMP fixture");

        assert_eq!(mime_type_for_path(&path), Some("application/postscript"));
        assert_eq!(read_dimensions(&path).expect("read EPS dimensions"), (1024, 768));
        let image = open_image(&path).expect("read EPS XMP preview");
        assert_eq!((image.width(), image.height()), (16, 16));

        fs::remove_file(path).expect("remove EPS fixture");
    }

    #[test]
    fn eps_without_preview_returns_helpful_error() {
        let path = std::env::temp_dir().join(format!("metalizer-eps-no-preview-{}.eps", std::process::id()));
        let eps_content = "%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 200 200\nshowpage\n";
        fs::write(&path, eps_content.as_bytes()).expect("write plain EPS fixture");

        let err = open_image(&path).unwrap_err();
        assert!(err.to_string().contains("File EPS tidak memiliki embedded preview"));

        fs::remove_file(path).expect("remove plain EPS fixture");
    }

    #[test]
    fn eps_vector_path_rendering_works() {
        let path = std::env::temp_dir().join(format!("metalizer-eps-vector-test-{}.eps", std::process::id()));
        let eps_content = r#"%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 400 300
%%Pages: 1
gsave
1 0 0 setrgbcolor
newpath
10 10 moveto
390 10 lineto
390 290 lineto
10 290 lineto
closepath
fill
grestore
showpage
"#;
        fs::write(&path, eps_content.as_bytes()).expect("write vector EPS fixture");

        assert_eq!(read_dimensions(&path).expect("read vector EPS dimensions"), (400, 300));
        let image = open_image(&path).expect("render vector EPS");
        assert!(image.width() > 0 && image.height() > 0);

        let data_url = preview_data_url(&path).expect("generate preview data url for vector EPS");
        assert!(data_url.starts_with("data:image/jpeg;base64,"));

        fs::remove_file(path).expect("remove vector EPS fixture");
    }

    #[test]
    fn vectorized_result_eps_file_renders_successfully() {
        let candidate = Path::new("../public/vectorized-result.eps");
        if candidate.exists() {
            assert_eq!(read_dimensions(candidate).expect("read dimensions"), (5168, 2907));
            let img = open_image(candidate).expect("render vectorized-result.eps");
            assert!(img.width() > 0 && img.height() > 0);
            let preview = preview_data_url(candidate).expect("preview data url");
            assert!(preview.starts_with("data:image/jpeg;base64,"));
        }
    }

    #[test]
    fn eps_with_xmp_xml_entities_works() {
        let path = std::env::temp_dir().join(format!("metalizer-eps-xmp-entities-{}.eps", std::process::id()));

        // Create a 16x16 test JPEG
        let jpeg_img = DynamicImage::ImageRgb8(image::RgbImage::new(16, 16));
        let mut jpeg_bytes = Vec::new();
        jpeg_img.write_to(&mut Cursor::new(&mut jpeg_bytes), ImageFormat::Jpeg).expect("encode test JPEG");
        let b64 = STANDARD.encode(&jpeg_bytes);
        // Inject &#xA; and &#xD; like Adobe Illustrator does
        let mut b64_with_entities = String::new();
        for chunk in b64.as_bytes().chunks(40) {
            b64_with_entities.push_str(std::str::from_utf8(chunk).unwrap());
            b64_with_entities.push_str("&#xA;&#xD;\n");
        }

        let eps_content = format!(
            "%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 1024 768\n<xmpGImg:image>\n{}\n</xmpGImg:image>\n",
            b64_with_entities
        );

        fs::write(&path, eps_content.as_bytes()).expect("write EPS XMP entities fixture");

        let image = open_image(&path).expect("read EPS XMP preview with XML entities");
        assert_eq!((image.width(), image.height()), (16, 16));

        fs::remove_file(path).expect("remove EPS fixture");
    }

    #[test]
    fn eps_3_eps_file_renders_successfully() {
        let candidate = Path::new("../3.eps");
        if candidate.exists() {
            let dims = read_dimensions(candidate).expect("read 3.eps dimensions");
            assert_eq!(dims, (2000, 2000));
            let img = open_image(candidate).expect("render 3.eps");
            assert!(img.width() > 0 && img.height() > 0);

            // Verify it is not all black
            let rgba = img.to_rgba8();
            let has_non_black = rgba.pixels().any(|p| p[0] > 0 || p[1] > 0 || p[2] > 0);
            assert!(has_non_black, "3.eps should not be blank black!");

            let preview = preview_data_url(candidate).expect("preview data url for 3.eps");
            assert!(preview.starts_with("data:image/jpeg;base64,"));
        }
    }
}

