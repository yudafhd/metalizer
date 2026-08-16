use std::collections::{HashMap, HashSet};

use base64::Engine;
use regex::Regex;
use reqwest::header::{ACCEPT, ACCEPT_LANGUAGE, USER_AGENT};
use serde_json::Value;
use url::Url;

use crate::errors::{AppError, AppResult};
use crate::models::{AdobePopulationSearchRequest, AdobePopulationSearchResult};

pub const MAX_POPULATION_SAMPLES: usize = 20;

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdobePreloadedMetadata {
    #[serde(default)]
    pub id: String,
    pub title: Option<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
    pub category: Option<u8>,
    pub contributor: Option<String>,
    pub asset_type: Option<String>,
    pub creation_date: Option<String>,
    pub thumbnail_url: Option<String>,
}

pub fn validate_search_request(request: &AdobePopulationSearchRequest) -> AppResult<()> {
    let words = request.query.split_whitespace().count();
    if !(1..=3).contains(&words) {
        return Err(AppError::InvalidRequest(
            "Search query harus berisi 1-3 kata utama berbahasa Inggris".to_string(),
        ));
    }
    if request.locale.trim().is_empty() || request.locale.contains('/') {
        return Err(AppError::InvalidRequest(
            "Locale Adobe tidak valid".to_string(),
        ));
    }
    if !matches!(
        request.asset_type.as_str(),
        "vector" | "illustration" | "photo" | "image"
    ) {
        return Err(AppError::InvalidRequest(format!(
            "Asset type '{}' tidak didukung",
            request.asset_type
        )));
    }
    if !matches!(
        request.sort.as_str(),
        "relevance" | "nb_downloads" | "creation"
    ) {
        return Err(AppError::InvalidRequest(format!(
            "Sort '{}' tidak didukung",
            request.sort
        )));
    }
    if request.limit == 0 {
        return Err(AppError::InvalidRequest(
            "Limit harus lebih besar dari nol".to_string(),
        ));
    }
    Ok(())
}

pub fn build_search_url(request: &AdobePopulationSearchRequest) -> AppResult<String> {
    validate_search_request(request)?;
    let locale = request.locale.trim();
    let mut url = Url::parse("https://stock.adobe.com")
        .map_err(|error| AppError::InvalidRequest(error.to_string()))?;
    url.path_segments_mut()
        .map_err(|_| AppError::InvalidRequest("Base URL Adobe tidak dapat dipakai".to_string()))?
        .push(locale)
        .push("search")
        .push("images");
    {
        let mut query = url.query_pairs_mut();
        let is_all_image_types = request.asset_type == "image";
        let content_filters = [
            ("photo", is_all_image_types || request.asset_type == "photo"),
            (
                "illustration",
                is_all_image_types || request.asset_type == "illustration",
            ),
            (
                "zip_vector",
                is_all_image_types || request.asset_type == "vector",
            ),
        ];
        for (content_type, enabled) in content_filters {
            query.append_pair(
                &format!("filters[content_type:{}]", content_type),
                if enabled { "1" } else { "0" },
            );
        }
        for content_type in ["video", "template", "3d", "audio"] {
            query.append_pair(&format!("filters[content_type:{}]", content_type), "0");
        }
        query.append_pair("filters[content_type:image]", "1");
        query.append_pair("filters[include_stock_enterprise]", "0");
        query.append_pair("filters[is_editorial]", "0");
        query.append_pair("filters[free_collection]", "0");
        query.append_pair("filters[globally_safe_collection]", "1");
        query.append_pair("k", request.query.trim());
        query.append_pair("order", request.sort.trim());
        query.append_pair("search_type", "filter-select");
        query.append_pair("get_facets", "1");
    }
    Ok(url.to_string())
}

pub fn extract_apollo_state_metadata(html: &str) -> HashMap<String, AdobePreloadedMetadata> {
    let mut map = HashMap::new();
    let script_re =
        Regex::new(r#"(?is)<script\b[^>]*>(.*?)</script>"#).expect("valid script regex");
    for captures in script_re.captures_iter(html) {
        let script_content = captures.get(1).map(|c| c.as_str()).unwrap_or_default();
        if !script_content.contains("keywords")
            && !script_content.contains("Metadata:")
            && !script_content.contains("__CLIENT_CONFIG__")
            && !script_content.contains("__APOLLO_STATE__")
            && !script_content.contains("__PRELOADED_STATE__")
            && !script_content.contains("__INITIAL_STATE__")
        {
            continue;
        }

        // Try direct deserialization
        if let Ok(json_val) = serde_json::from_str::<Value>(script_content.trim()) {
            scan_json_for_metadata(&json_val, &mut map);
            continue;
        }

        // Look for JSON assignments: = { ... }
        let assign_re = Regex::new(r#"=\s*(\{.+)"#).expect("valid assignment regex");
        for assign_cap in assign_re.captures_iter(script_content) {
            if let Some(slice_match) = assign_cap.get(1) {
                let slice = slice_match.as_str();
                let mut de = serde_json::Deserializer::from_str(slice).into_iter::<Value>();
                if let Some(Ok(json_val)) = de.next() {
                    scan_json_for_metadata(&json_val, &mut map);
                }
            }
        }

        // Also scan through opening braces
        for (start_idx, _) in script_content.match_indices('{') {
            let slice = &script_content[start_idx..];
            let mut de = serde_json::Deserializer::from_str(slice).into_iter::<Value>();
            if let Some(Ok(json_val)) = de.next() {
                if json_val.is_object() {
                    scan_json_for_metadata(&json_val, &mut map);
                }
            }
        }
    }

    if map.is_empty() {
        let config_re = Regex::new(
            r#"(?s)(?:window\.__CLIENT_CONFIG__|window\.__APOLLO_STATE__|window\.__PRELOADED_STATE__|window\.__INITIAL_STATE__)\s*=\s*(\{.*?\});"#,
        )
        .expect("valid config regex");
        for captures in config_re.captures_iter(html) {
            if let Some(matched) = captures.get(1) {
                if let Ok(val) = serde_json::from_str::<Value>(matched.as_str()) {
                    scan_json_for_metadata(&val, &mut map);
                }
            }
        }
    }
    map
}

fn scan_json_for_metadata(value: &Value, map: &mut HashMap<String, AdobePreloadedMetadata>) {
    match value {
        Value::Object(obj) => {
            if obj.contains_key("keywords") {
                if let Some(meta) = parse_generic_metadata_object(obj) {
                    if !meta.id.is_empty() {
                        map.insert(meta.id.clone(), meta);
                    } else {
                        map.insert(format!("generic_{}", map.len()), meta);
                    }
                }
            }
            for (k, v) in obj {
                if is_metadata_key(k) {
                    if let Some(meta) = parse_metadata_object(k, v) {
                        if !meta.id.is_empty() {
                            map.insert(meta.id.clone(), meta);
                        }
                    }
                }
                scan_json_for_metadata(v, map);
            }
        }
        Value::Array(arr) => {
            for item in arr {
                scan_json_for_metadata(item, map);
            }
        }
        _ => {}
    }
}

fn parse_generic_metadata_object(
    obj: &serde_json::Map<String, Value>,
) -> Option<AdobePreloadedMetadata> {
    let mut keywords = Vec::new();
    if let Some(kw_val) = obj.get("keywords") {
        if let Some(kw_arr) = kw_val.as_array() {
            for kw in kw_arr {
                if let Some(s) = kw.as_str() {
                    let cleaned = decode_html_entities(s).trim().to_string();
                    if !cleaned.is_empty() && !keywords.contains(&cleaned) {
                        keywords.push(cleaned);
                    }
                } else if let Some(kw_obj) = kw.as_object() {
                    if let Some(name) = kw_obj
                        .get("name")
                        .or_else(|| kw_obj.get("keyword"))
                        .or_else(|| kw_obj.get("label"))
                        .and_then(Value::as_str)
                    {
                        let cleaned = decode_html_entities(name).trim().to_string();
                        if !cleaned.is_empty() && !keywords.contains(&cleaned) {
                            keywords.push(cleaned);
                        }
                    }
                }
            }
        } else if let Some(s) = kw_val.as_str() {
            for item in s.split(',') {
                let cleaned = decode_html_entities(item).trim().to_string();
                if !cleaned.is_empty() && !keywords.contains(&cleaned) {
                    keywords.push(cleaned);
                }
            }
        }
    }

    if keywords.is_empty() {
        return None;
    }

    let id = obj
        .get("_id")
        .or_else(|| obj.get("id"))
        .or_else(|| obj.get("asset_id"))
        .or_else(|| obj.get("assetId"))
        .and_then(|v| {
            if let Some(s) = v.as_str() {
                Some(s.to_string())
            } else if let Some(n) = v.as_u64() {
                Some(n.to_string())
            } else {
                None
            }
        })
        .unwrap_or_default();

    let title = obj
        .get("title")
        .or_else(|| obj.get("name"))
        .or_else(|| obj.get("headline"))
        .and_then(Value::as_str)
        .map(|s| decode_html_entities(s).trim().to_string());

    let category = obj.get("category").and_then(|v| {
        if let Some(num) = v.as_u64() {
            Some(num as u8)
        } else if let Some(s) = v.as_str() {
            s.parse::<u8>().ok()
        } else if let Some(cat_obj) = v.as_object() {
            cat_obj.get("id").and_then(Value::as_u64).map(|n| n as u8)
        } else {
            None
        }
    });

    let contributor = obj
        .get("contributor")
        .or_else(|| obj.get("author"))
        .or_else(|| obj.get("creator"))
        .and_then(|v| {
            if let Some(s) = v.as_str() {
                Some(decode_html_entities(s).trim().to_string())
            } else if let Some(c_obj) = v.as_object() {
                c_obj
                    .get("name")
                    .or_else(|| c_obj.get("author"))
                    .and_then(Value::as_str)
                    .map(|s| decode_html_entities(s).trim().to_string())
            } else {
                None
            }
        });

    let asset_type = obj
        .get("assetType")
        .or_else(|| obj.get("asset_type"))
        .or_else(|| obj.get("vectorType"))
        .and_then(Value::as_str)
        .map(|s| s.to_string());

    let creation_date = obj
        .get("creationDate")
        .or_else(|| obj.get("creation_date"))
        .or_else(|| obj.get("publishedDate"))
        .and_then(Value::as_str)
        .map(|s| s.to_string());

    let thumbnail_url = obj
        .get("thumbnail1000")
        .or_else(|| obj.get("thumbnail500"))
        .or_else(|| obj.get("thumbnail360"))
        .or_else(|| obj.get("thumbnail_url"))
        .or_else(|| obj.get("image"))
        .and_then(Value::as_str)
        .map(|s| s.to_string());

    Some(AdobePreloadedMetadata {
        id,
        title,
        keywords,
        category,
        contributor,
        asset_type,
        creation_date,
        thumbnail_url,
    })
}

fn is_metadata_key(key: &str) -> bool {
    key.starts_with("VectorMetadata:")
        || key.starts_with("IllustrationMetadata:")
        || key.starts_with("PhotoMetadata:")
        || key.starts_with("ImageMetadata:")
        || key.starts_with("MediaMetadata:")
        || key.starts_with("AssetMetadata:")
        || key.starts_with("Content:")
        || key.starts_with("Asset:")
        || (key.contains("Metadata:")
            && key
                .split(':')
                .nth(1)
                .map_or(false, |id| id.chars().all(|c| c.is_ascii_digit())))
}

fn parse_metadata_object(key: &str, value: &Value) -> Option<AdobePreloadedMetadata> {
    let obj = value.as_object()?;

    let id_from_key = key.split(':').nth(1).map(|s| s.trim().to_string());
    let id_from_obj = obj.get("_id").or_else(|| obj.get("id")).and_then(|v| {
        if let Some(s) = v.as_str() {
            Some(s.to_string())
        } else if let Some(n) = v.as_u64() {
            Some(n.to_string())
        } else {
            None
        }
    });
    let id = id_from_obj.or(id_from_key)?;
    if id.is_empty() {
        return None;
    }

    let title = obj
        .get("title")
        .and_then(Value::as_str)
        .map(|s| decode_html_entities(s).trim().to_string());

    let mut keywords = Vec::new();
    if let Some(kw_val) = obj.get("keywords") {
        if let Some(kw_arr) = kw_val.as_array() {
            for kw in kw_arr {
                if let Some(s) = kw.as_str() {
                    let cleaned = decode_html_entities(s).trim().to_string();
                    if !cleaned.is_empty() && !keywords.contains(&cleaned) {
                        keywords.push(cleaned);
                    }
                } else if let Some(kw_obj) = kw.as_object() {
                    if let Some(name) = kw_obj
                        .get("name")
                        .or_else(|| kw_obj.get("keyword"))
                        .or_else(|| kw_obj.get("label"))
                        .and_then(Value::as_str)
                    {
                        let cleaned = decode_html_entities(name).trim().to_string();
                        if !cleaned.is_empty() && !keywords.contains(&cleaned) {
                            keywords.push(cleaned);
                        }
                    }
                }
            }
        }
    }

    let category = obj.get("category").and_then(|v| {
        if let Some(num) = v.as_u64() {
            Some(num as u8)
        } else if let Some(s) = v.as_str() {
            s.parse::<u8>().ok()
        } else if let Some(cat_obj) = v.as_object() {
            cat_obj.get("id").and_then(Value::as_u64).map(|n| n as u8)
        } else {
            None
        }
    });

    let contributor = obj.get("contributor").and_then(|v| {
        if let Some(s) = v.as_str() {
            Some(decode_html_entities(s).trim().to_string())
        } else if let Some(c_obj) = v.as_object() {
            c_obj
                .get("name")
                .or_else(|| c_obj.get("author"))
                .and_then(Value::as_str)
                .map(|s| decode_html_entities(s).trim().to_string())
        } else {
            None
        }
    });

    let asset_type = obj
        .get("assetType")
        .or_else(|| obj.get("asset_type"))
        .or_else(|| obj.get("vectorType"))
        .and_then(Value::as_str)
        .map(|s| s.to_string());

    let creation_date = obj
        .get("creationDate")
        .or_else(|| obj.get("creation_date"))
        .or_else(|| obj.get("publishedDate"))
        .and_then(Value::as_str)
        .map(|s| s.to_string());

    let thumbnail_url = obj
        .get("thumbnail1000")
        .or_else(|| obj.get("thumbnail500"))
        .or_else(|| obj.get("thumbnail360"))
        .or_else(|| obj.get("thumbnail_url"))
        .and_then(Value::as_str)
        .map(|s| s.to_string());

    Some(AdobePreloadedMetadata {
        id,
        title,
        keywords,
        category,
        contributor,
        asset_type,
        creation_date,
        thumbnail_url,
    })
}

#[allow(dead_code)]
pub fn extract_meta_tags_metadata(html: &str) -> Option<AdobePreloadedMetadata> {
    let kw_re = Regex::new(
        r#"(?is)<meta\b[^>]*\bname\s*=\s*["']keywords["'][^>]*\bcontent\s*=\s*["']([^"']+)["']"#,
    )
    .ok()?;
    let title_re = Regex::new(r#"(?is)<meta\b[^>]*\bproperty\s*=\s*["']og:title["'][^>]*\bcontent\s*=\s*["']([^"']+)["']"#).ok()?;
    let img_re = Regex::new(r#"(?is)<meta\b[^>]*\bproperty\s*=\s*["']og:image["'][^>]*\bcontent\s*=\s*["']([^"']+)["']"#).ok()?;

    let keywords = kw_re
        .captures(html)
        .and_then(|c| c.get(1))
        .map(|m| {
            m.as_str()
                .split(',')
                .map(|s| decode_html_entities(s.trim()))
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let title = title_re
        .captures(html)
        .and_then(|c| c.get(1))
        .map(|m| decode_html_entities(m.as_str().trim()));
    let thumbnail_url = img_re
        .captures(html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string());

    if keywords.is_empty() && title.is_none() {
        return None;
    }

    Some(AdobePreloadedMetadata {
        id: String::new(),
        title,
        keywords,
        category: None,
        contributor: None,
        asset_type: None,
        creation_date: None,
        thumbnail_url,
    })
}

#[allow(dead_code)]
pub fn extract_json_ld_metadata(html: &str) -> Option<AdobePreloadedMetadata> {
    let ld_re = Regex::new(
        r#"(?is)<script\b[^>]*\btype\s*=\s*["']application/ld\+json["'][^>]*>(.*?)</script>"#,
    )
    .ok()?;
    for captures in ld_re.captures_iter(html) {
        let content = captures.get(1).map(|c| c.as_str()).unwrap_or_default();
        if let Ok(val) = serde_json::from_str::<Value>(content.trim()) {
            if let Some(obj) = val.as_object() {
                let title = obj
                    .get("name")
                    .or_else(|| obj.get("headline"))
                    .and_then(Value::as_str)
                    .map(|s| decode_html_entities(s.trim()));
                let mut keywords = Vec::new();
                if let Some(kw_val) = obj.get("keywords") {
                    if let Some(s) = kw_val.as_str() {
                        for kw in s.split(',') {
                            let cleaned = decode_html_entities(kw.trim());
                            if !cleaned.is_empty() && !keywords.contains(&cleaned) {
                                keywords.push(cleaned);
                            }
                        }
                    } else if let Some(arr) = kw_val.as_array() {
                        for item in arr {
                            if let Some(s) = item.as_str() {
                                let cleaned = decode_html_entities(s.trim());
                                if !cleaned.is_empty() && !keywords.contains(&cleaned) {
                                    keywords.push(cleaned);
                                }
                            }
                        }
                    }
                }
                let contributor = obj
                    .get("author")
                    .or_else(|| obj.get("creator"))
                    .and_then(|a| {
                        if let Some(s) = a.as_str() {
                            Some(decode_html_entities(s.trim()))
                        } else if let Some(a_obj) = a.as_object() {
                            a_obj
                                .get("name")
                                .and_then(Value::as_str)
                                .map(|s| decode_html_entities(s.trim()))
                        } else {
                            None
                        }
                    });
                let thumbnail_url = obj
                    .get("thumbnailUrl")
                    .or_else(|| obj.get("image"))
                    .and_then(|img| {
                        if let Some(s) = img.as_str() {
                            Some(s.to_string())
                        } else if let Some(img_obj) = img.as_object() {
                            img_obj
                                .get("url")
                                .and_then(Value::as_str)
                                .map(|s| s.to_string())
                        } else {
                            None
                        }
                    });
                if !keywords.is_empty() || title.is_some() {
                    return Some(AdobePreloadedMetadata {
                        id: String::new(),
                        title,
                        keywords,
                        category: None,
                        contributor,
                        asset_type: None,
                        creation_date: None,
                        thumbnail_url,
                    });
                }
            }
        }
    }
    None
}

#[allow(dead_code)]
pub fn extract_html_keywords_and_title(html: &str) -> Option<AdobePreloadedMetadata> {
    let mut keywords = Vec::new();

    // 1. Meta tag keywords
    let meta_kw_re = Regex::new(
        r#"(?is)<meta\b[^>]*\bname\s*=\s*["']keywords["'][^>]*\bcontent\s*=\s*["']([^"']+)["']"#,
    )
    .ok()?;
    if let Some(caps) = meta_kw_re.captures(html) {
        if let Some(m) = caps.get(1) {
            for s in m.as_str().split(',') {
                let cleaned = decode_html_entities(s.trim());
                if !cleaned.is_empty() && !keywords.contains(&cleaned) {
                    keywords.push(cleaned);
                }
            }
        }
    }

    // 2. Keyword tag links (e.g. href="/.../search?k=shrimp" or similar)
    if keywords.is_empty() {
        if let Ok(tag_re) = Regex::new(
            r#"(?is)<a\b[^>]*\bhref\s*=\s*["'][^"']*[?&]k=([^"'\&]+)["'][^>]*>(.*?)</a>"#,
        ) {
            for caps in tag_re.captures_iter(html) {
                let text = caps
                    .get(2)
                    .map(|m| decode_html_entities(m.as_str().trim()))
                    .unwrap_or_default();
                let stripped = strip_html_tags(&text);
                if !stripped.is_empty() && stripped.len() < 50 && !keywords.contains(&stripped) {
                    keywords.push(stripped);
                }
            }
        }
    }

    // 3. Title from og:title or <title>
    let title_re = Regex::new(
        r#"(?is)<meta\b[^>]*\bproperty\s*=\s*["']og:title["'][^>]*\bcontent\s*=\s*["']([^"']+)["']"#,
    )
    .ok()?;
    let title = title_re
        .captures(html)
        .and_then(|c| c.get(1))
        .map(|m| decode_html_entities(m.as_str().trim()));

    if keywords.is_empty() && title.is_none() {
        return None;
    }

    Some(AdobePreloadedMetadata {
        id: String::new(),
        title,
        keywords,
        category: None,
        contributor: None,
        asset_type: None,
        creation_date: None,
        thumbnail_url: None,
    })
}

#[allow(dead_code)]
pub async fn fetch_detail_metadata(
    client: &reqwest::Client,
    url: &str,
    locale: &str,
) -> Option<AdobePreloadedMetadata> {
    let response = client
        .get(url)
        .header(
            USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        )
        .header(
            ACCEPT,
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        )
        .header(ACCEPT_LANGUAGE, format!("{},en-US;q=0.9,en;q=0.8", locale))
        .header("Sec-Ch-Ua", "\"Chromium\";v=\"122\", \"Not(A:Brand\";v=\"24\", \"Google Chrome\";v=\"122\"")
        .header("Sec-Ch-Ua-Mobile", "?0")
        .header("Sec-Ch-Ua-Platform", "\"Windows\"")
        .header("Sec-Fetch-Dest", "document")
        .header("Sec-Fetch-Mode", "navigate")
        .header("Sec-Fetch-Site", "none")
        .header("Sec-Fetch-User", "?1")
        .header("Upgrade-Insecure-Requests", "1")
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let html = response.text().await.ok()?;
    let apollo_map = extract_apollo_state_metadata(&html);
    if let Some(meta) = apollo_map
        .into_values()
        .find(|m| !m.keywords.is_empty() || m.title.is_some())
    {
        return Some(meta);
    }
    if let Some(meta) = extract_json_ld_metadata(&html) {
        if !meta.keywords.is_empty() || meta.title.is_some() {
            return Some(meta);
        }
    }
    if let Some(meta) = extract_html_keywords_and_title(&html) {
        if !meta.keywords.is_empty() || meta.title.is_some() {
            return Some(meta);
        }
    }
    extract_meta_tags_metadata(&html)
}

pub async fn scrape_population_full_webview<F>(
    app: &tauri::AppHandle,
    search_url: &str,
    limit: usize,
    mut progress_cb: F,
) -> AppResult<Vec<AdobePopulationSearchResult>>
where
    F: FnMut(usize, usize, &str, Option<&str>, usize),
{
    use std::time::Duration;
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    let script = r#"
        (function() {
            if (window.__METALIZER_ADOBE_EXTRACTOR__) return;
            window.__METALIZER_ADOBE_EXTRACTOR__ = true;

            function encodePayload(value) {
                const bytes = new TextEncoder().encode(JSON.stringify(value));
                let binary = '';
                for (const byte of bytes) binary += String.fromCharCode(byte);
                return btoa(binary);
            }

            function publish(marker, value) {
                const encoded = encodePayload(value);
                const base = window.location.pathname + window.location.search;
                history.replaceState(null, '', base + '#' + marker + encoded);
                document.title = marker + JSON.stringify(value);
            }

            function assetIdFromHref(rawHref) {
                try {
                    const parsed = new URL(rawHref, window.location.href);
                    const segments = parsed.pathname.split('/').filter(Boolean);
                    for (let index = segments.length - 1; index >= 0; index -= 1) {
                        if (/^\d{5,}$/.test(segments[index])) return segments[index];
                    }
                    const queryId = parsed.searchParams.get('asset_id') || parsed.searchParams.get('assetId');
                    return queryId && /^\d{5,}$/.test(queryId) ? queryId : null;
                } catch (_) {
                    return null;
                }
            }

            function isAssetHref(rawHref) {
                try {
                    const parsed = new URL(rawHref, window.location.href);
                    return parsed.hostname === 'stock.adobe.com'
                        && /\/(images|asset|video|templates|3d-assets)\//.test(parsed.pathname);
                } catch (_) {
                    return false;
                }
            }

            function stateSources() {
                return [
                    window.__CLIENT_CONFIG__,
                    window.__APOLLO_STATE__,
                    window.__APOLLO_CACHE__,
                    window.__PRELOADED_STATE__,
                    window.__INITIAL_STATE__,
                    window.__INITIAL_DATA__,
                    window.__PRELOADED_DATA__,
                    window.__NEXT_DATA__
                ].filter(Boolean);
            }

            function scalarText(value) {
                if (value === null || value === undefined) return null;
                const resolved = resolveReference(value);
                if (resolved !== value) return scalarText(resolved);
                if (typeof value === 'string' || typeof value === 'number') return String(value);
                if (typeof value === 'object') {
                    return scalarText(value.name || value.label || value.value || value.url || value.href);
                }
                return null;
            }

            function categoryNumber(value) {
                value = resolveReference(value);
                const raw = value && typeof value === 'object' ? (value.id || value.categoryId || value.value) : value;
                const parsed = Number(raw);
                return Number.isInteger(parsed) && parsed > 0 && parsed <= 255 ? parsed : null;
            }

            function resolveReference(value) {
                if (!value || typeof value !== 'object' || !value.__ref) return value;
                const reference = String(value.__ref);
                const visited = new Set();
                const visit = (node) => {
                    if (!node || typeof node !== 'object' || visited.has(node)) return null;
                    visited.add(node);
                    if (Object.prototype.hasOwnProperty.call(node, reference)) return node[reference];
                    if (Array.isArray(node)) {
                        for (const item of node) {
                            const found = visit(item);
                            if (found) return found;
                        }
                        return null;
                    }
                    for (const key of Object.keys(node)) {
                        const found = visit(node[key]);
                        if (found) return found;
                    }
                    return null;
                };
                for (const source of stateSources()) {
                    const found = visit(source);
                    if (found) return found;
                }
                return value;
            }

            function keywordsFrom(value) {
                if (Array.isArray(value)) {
                    return value
                        .map(item => typeof item === 'string' ? item : (item?.name || item?.keyword || item?.label || ''))
                        .map(item => String(item).trim())
                        .filter(Boolean);
                }
                if (typeof value === 'string') {
                    return value.split(',').map(item => item.trim()).filter(Boolean);
                }
                return [];
            }

            function hasMetadata(value) {
                if (!value || typeof value !== 'object') return false;
                return keywordsFrom(value.keywords || value.tags || value.keywordList).length > 0
                    || Boolean(value.title || value.name || value.contributor || value.author || value.creationDate || value.creation_date);
            }

            function metadataForId(id) {
                const visited = new Set();
                const visit = (value) => {
                    if (!value || typeof value !== 'object' || visited.has(value)) return null;
                    visited.add(value);
                    if (Array.isArray(value)) {
                        for (const item of value) {
                            const found = visit(item);
                            if (found) return found;
                        }
                        return null;
                    }
                    let fallback = null;
                    for (const key of Object.keys(value)) {
                        if (key.includes(id) || key.includes('Metadata:' + id)) {
                            const candidate = value[key];
                            if (keywordsFrom(candidate?.keywords || candidate?.tags || candidate?.keywordList).length > 0) return candidate;
                            const nested = visit(candidate);
                            if (nested) return nested;
                            if (!fallback && hasMetadata(candidate)) fallback = candidate;
                        }
                    }
                    if (fallback) return fallback;
                    const objectId = value._id || value.id || value.assetId || value.asset_id;
                    if (String(objectId || '') === String(id) && hasMetadata(value)) return value;
                    for (const key of Object.keys(value)) {
                        const found = visit(value[key]);
                        if (found) return found;
                    }
                    return null;
                };
                for (const source of stateSources()) {
                    const found = visit(source);
                    if (found) return found;
                }
                for (const node of document.querySelectorAll('script[type="application/json"], script:not([src])')) {
                    try {
                        const parsed = JSON.parse(node.textContent || 'null');
                        const found = visit(parsed);
                        if (found) return found;
                    } catch (_) {}
                }
                return null;
            }

            function domKeywords() {
                const values = [];
                const seen = new Set();
                const add = (value) => {
                    String(value || '').split(/[\n,|]+/).map(item => item.trim()).filter(item => item.length > 1 && item.length < 50).forEach(item => {
                        const key = item.toLowerCase();
                        if (!seen.has(key)) {
                            seen.add(key);
                            values.push(item);
                        }
                    });
                };
                const selectors = [
                    'meta[name="keywords"]',
                    'a[href*="k="]',
                    '[data-testid*="keyword"]',
                    '[data-test*="keyword"]',
                    '[data-t*="keyword"]',
                    '[class*="keyword"]'
                ];
                for (const node of document.querySelectorAll(selectors.join(','))) {
                    add(node.content || node.textContent);
                }
                const lines = (document.body?.innerText || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
                const keywordHeading = lines.findIndex(line => /^(similar\s+)?keywords$/i.test(line) || /similar keywords/i.test(line));
                if (keywordHeading >= 0) {
                    for (const line of lines.slice(keywordHeading + 1, keywordHeading + 80)) {
                        if (/^(save|download|edit|generate|file\s*#|category|license|dimensions|settings|report|see more|similar assets)/i.test(line)) break;
                        add(line);
                    }
                }
                return values;
            }

            function domContributor() {
                const explicit = document.querySelector('[rel="author"], a[href*="/contributor/"], a[href*="/member/"], [data-testid*="author"], [data-testid*="contributor"]');
                const explicitText = scalarText(explicit?.textContent);
                if (explicitText) return explicitText.replace(/^by\s+/i, '').trim();
                const lines = (document.body?.innerText || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
                const authorLine = lines.find(line => /^by\s+/i.test(line));
                return authorLine ? authorLine.replace(/^by\s+/i, '').trim() : null;
            }

            function attemptExtract() {
                try {
                    let isSearch = window.location.pathname.includes('/search');

                    if (isSearch) {
                        let anchors = Array.from(document.querySelectorAll('a[href]'))
                            .filter(a => isAssetHref(a.href));
                        let items = [];
                        let seen = new Set();
                        for (let a of anchors) {
                            let href = a.href;
                            let id = assetIdFromHref(href);
                            if (!id || seen.has(id)) continue;
                            seen.add(id);

                            let metaObj = metadataForId(id);
                            let kw = keywordsFrom(metaObj?.keywords || metaObj?.tags || metaObj?.keywordList);
                            let title = metaObj?.title || a.querySelector('img')?.alt || a.getAttribute('aria-label') || a.title || a.innerText?.trim() || null;
                            items.push({
                                rank: items.length + 1,
                                url: href,
                                assetId: id,
                                title: title,
                                keywords: kw.filter(Boolean),
                                category: categoryNumber(metaObj?.category),
                                contributor: scalarText(metaObj?.contributor || metaObj?.author),
                                assetType: scalarText(metaObj?.assetType || metaObj?.vectorType || metaObj?.asset_type),
                                creationDate: scalarText(metaObj?.creationDate || metaObj?.creation_date || metaObj?.dateCreated),
                                thumbnailUrl: scalarText(metaObj?.thumbnail1000 || metaObj?.thumbnail500 || metaObj?.thumbnail360) || a.querySelector('img')?.src || null
                            });
                        }
                        if (items.length > 0) {
                            publish('__METALIZER_SEARCH__', items);
                        }
                    } else {
                        let result = null;
                        const detailId = assetIdFromHref(window.location.href);
                        const detailObj = detailId ? metadataForId(detailId) : null;
                        if (detailObj) {
                            const kwArr = keywordsFrom(detailObj.keywords || detailObj.tags || detailObj.keywordList);
                            result = {
                                id: String(detailObj._id || detailObj.id || detailId || ''),
                                title: detailObj.title || detailObj.name || null,
                                keywords: kwArr.filter(Boolean),
                                category: categoryNumber(detailObj.category),
                                contributor: scalarText(detailObj.contributor || detailObj.author || detailObj.user || detailObj.creator || detailObj.owner),
                                assetType: scalarText(detailObj.assetType || detailObj.vectorType || detailObj.asset_type),
                                creationDate: scalarText(detailObj.creationDate || detailObj.creation_date || detailObj.dateCreated),
                                thumbnailUrl: scalarText(detailObj.thumbnail1000 || detailObj.thumbnail500 || detailObj.thumbnail360)
                            };
                        }
                        if (!result || !result.keywords.length) {
                            let keywords = domKeywords();
                            if (!keywords.length) {
                                for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
                                    try {
                                        const json = JSON.parse(node.textContent || 'null');
                                        const candidates = Array.isArray(json) ? json : [json];
                                        for (const candidate of candidates) {
                                            const found = keywordsFrom(candidate?.keywords);
                                            if (found.length) {
                                                keywords = found;
                                                if (!result) result = { id: detailId || '', title: candidate?.name || null, keywords: [], category: null, contributor: candidate?.author?.name || candidate?.author || null, assetType: null, creationDate: candidate?.dateCreated || candidate?.datePublished || null, thumbnailUrl: candidate?.image || null };
                                                break;
                                            }
                                        }
                                    } catch (_) {}
                                    if (keywords.length) break;
                                }
                            }
                            let ogTitle = document.querySelector('meta[property="og:title"]');
                            let title = ogTitle && ogTitle.content ? ogTitle.content : (document.querySelector('h1')?.innerText?.trim() || null);
                            if (!result && (keywords.length || title)) {
                                result = { id: detailId || '', title: title, keywords: keywords, category: null, contributor: null, assetType: null, creationDate: null, thumbnailUrl: null };
                            } else if (result) {
                                result.keywords = result.keywords.length ? result.keywords : keywords;
                                result.title = result.title || title;
                            }
                        }
                        if (result) {
                            result.contributor = result.contributor || domContributor();
                        }
                        // Wait for the actual keyword list before publishing. A
                        // title is often available before Adobe hydrates the
                        // detail metadata and must not end the polling early.
                        if (result && result.keywords.length > 0) {
                            publish('__METALIZER_DETAIL__', result);
                        }
                    }
                } catch (e) {
                    document.title = "__SCRAPED_ERR__:" + String(e);
                }
            }
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                attemptExtract();
            }
            window.addEventListener('DOMContentLoaded', attemptExtract);
            window.addEventListener('load', attemptExtract);
            setInterval(attemptExtract, 350);
        })();
    "#;

    let window_label = "adobe_browser_scraper";
    if let Some(existing) = app.get_webview_window(window_label) {
        let _ = existing.close();
    }

    let search_url_parsed = search_url
        .parse()
        .map_err(|e: url::ParseError| AppError::InvalidRequest(e.to_string()))?;

    let window =
        WebviewWindowBuilder::new(app, window_label, WebviewUrl::External(search_url_parsed))
            .visible(false)
            .focused(false)
            .inner_size(960.0, 680.0)
            .center()
            .title("Metalizer — Adobe Stock Scraper (Live)")
            .initialization_script(script)
            .build()
            .map_err(|e| {
                AppError::Network(format!("Gagal membuka jendela browser Adobe: {:?}", e))
            })?;

    // Step 1: Wait for search page to load and extract sample items
    let mut search_items: Vec<AdobePopulationSearchResult> = Vec::new();
    let search_deadline = tokio::time::Instant::now() + Duration::from_secs(20);

    while tokio::time::Instant::now() < search_deadline {
        let payload = window
            .url()
            .ok()
            .and_then(|url| url.fragment().map(str::to_string))
            .and_then(|fragment| {
                fragment
                    .strip_prefix("__METALIZER_SEARCH__")
                    .map(str::to_string)
            })
            .and_then(|encoded| {
                base64::engine::general_purpose::STANDARD
                    .decode(encoded)
                    .ok()
            })
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .or_else(|| {
                window.title().ok().and_then(|title| {
                    title
                        .strip_prefix("__METALIZER_SEARCH__")
                        .map(str::to_string)
                })
            });
        if let Some(json_str) = payload {
            if let Ok(items) = serde_json::from_str::<Vec<AdobePopulationSearchResult>>(&json_str) {
                if !items.is_empty() {
                    search_items = items;
                    break;
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }

    // Limit the items according to requested limit
    search_items.truncate(limit);
    let total = search_items.len();

    // The search result only contains the URL/title in many Adobe responses.
    // Open every detail page in the same visible WebView so the page's own
    // state/DOM can provide the original keywords and other metadata.
    let read_marker = |marker: &str, expected_asset_id: Option<&str>| {
        let current_url = window.url().ok();
        let current_url_matches = expected_asset_id
            .map(|asset_id| {
                current_url
                    .as_ref()
                    .map(|url| url.path().split('/').any(|segment| segment == asset_id))
                    .unwrap_or(false)
            })
            .unwrap_or(true);
        let payload = current_url
            .as_ref()
            .and_then(|url| url.fragment().map(str::to_string))
            .and_then(|fragment| fragment.strip_prefix(marker).map(str::to_string))
            .and_then(|encoded| {
                base64::engine::general_purpose::STANDARD
                    .decode(encoded)
                    .ok()
            })
            .and_then(|bytes| String::from_utf8(bytes).ok());
        if payload.is_some() {
            return payload;
        }
        if !current_url_matches {
            return None;
        }
        window
            .title()
            .ok()
            .and_then(|title| title.strip_prefix(marker).map(str::to_string))
            .filter(|value| {
                expected_asset_id
                    .and_then(|asset_id| {
                        serde_json::from_str::<AdobePreloadedMetadata>(value)
                            .ok()
                            .map(|metadata| metadata.id.is_empty() || metadata.id == asset_id)
                    })
                    .unwrap_or(true)
            })
    };

    for (index, sample) in search_items.iter_mut().enumerate() {
        let current = index + 1;
        progress_cb(
            current,
            total,
            &sample.url,
            sample.title.as_deref(),
            sample.keywords.len(),
        );

        if let Ok(target_url) = sample.url.parse::<url::Url>() {
            let _ = window.navigate(target_url);
        }

        let detail_started = tokio::time::Instant::now();
        let mut reinjected = false;
        let detail_deadline = tokio::time::Instant::now() + Duration::from_secs(12);
        while tokio::time::Instant::now() < detail_deadline {
            // Tauri's initialization script is normally applied to each
            // document, but explicitly reinject once after navigation as a
            // fallback for WebView2 navigations that replace the document.
            if !reinjected && detail_started.elapsed() >= Duration::from_millis(700) {
                let _ = window.eval(script);
                reinjected = true;
            }
            if let Some(json_str) = read_marker("__METALIZER_DETAIL__", sample.asset_id.as_deref())
            {
                if let Ok(metadata) = serde_json::from_str::<AdobePreloadedMetadata>(&json_str) {
                    if !metadata.keywords.is_empty() || metadata.title.is_some() {
                        if sample.title.is_none() || metadata.title.is_some() {
                            sample.title = metadata.title.clone();
                        }
                        if !metadata.keywords.is_empty() {
                            sample.keywords = metadata.keywords;
                        }
                        if sample.category.is_none() {
                            sample.category = metadata.category;
                        }
                        if sample.contributor.is_none() {
                            sample.contributor = metadata.contributor;
                        }
                        if sample.asset_type.is_none() {
                            sample.asset_type = metadata.asset_type;
                        }
                        if sample.creation_date.is_none() {
                            sample.creation_date = metadata.creation_date;
                        }
                        if sample.thumbnail_url.is_none() {
                            sample.thumbnail_url = metadata.thumbnail_url;
                        }
                        break;
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(350)).await;
        }

        progress_cb(
            current,
            total,
            &sample.url,
            sample.title.as_deref(),
            sample.keywords.len(),
        );
        tokio::time::sleep(Duration::from_millis(1500)).await;
    }

    // The scraper WebView remains hidden during the run and is closed after
    // the last detail page has been processed.
    let _ = window.close();

    Ok(search_items)
}

#[allow(dead_code)]
pub async fn scrape_samples_via_webview<F>(
    app: &tauri::AppHandle,
    samples: &mut [AdobePopulationSearchResult],
    mut progress_cb: F,
) where
    F: FnMut(usize, usize, &str, Option<&str>, usize),
{
    use std::time::Duration;
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    let script = r#"
        (function() {
            function attemptExtract() {
                try {
                    let state = window.__CLIENT_CONFIG__ || window.__APOLLO_STATE__ || window.__PRELOADED_STATE__ || {};
                    let result = null;
                    for (let k in state) {
                        if (k.includes('Metadata:') || k.includes('Vector') || k.includes('Asset') || k.includes('Illustration') || k.includes('Photo')) {
                            let obj = state[k];
                            if (obj && obj.keywords && obj.keywords.length) {
                                result = {
                                    id: String(obj._id || obj.id || ''),
                                    title: obj.title || null,
                                    keywords: Array.isArray(obj.keywords) ? obj.keywords.map(kw => typeof kw === 'string' ? kw : kw.name || kw.keyword || '') : [],
                                    category: obj.category ? (typeof obj.category === 'number' ? obj.category : obj.category.id) : null,
                                    contributor: obj.contributor ? (typeof obj.contributor === 'string' ? obj.contributor : obj.contributor.name) : null,
                                    assetType: obj.assetType || obj.vectorType || null,
                                    creationDate: obj.creationDate || null,
                                    thumbnailUrl: obj.thumbnail1000 || obj.thumbnail500 || obj.thumbnail360 || null
                                };
                                break;
                            }
                        }
                    }
                    if (!result) {
                        let metaKw = document.querySelector('meta[name="keywords"]');
                        let keywords = metaKw && metaKw.content ? metaKw.content.split(',').map(s => s.trim()).filter(Boolean) : [];
                        if (!keywords.length) {
                            let tags = Array.from(document.querySelectorAll('a[href*="k="], .tag, .keyword-item'));
                            keywords = tags.map(t => t.textContent.trim()).filter(s => s.length > 1 && s.length < 40);
                        }
                        let ogTitle = document.querySelector('meta[property="og:title"]');
                        let title = ogTitle && ogTitle.content ? ogTitle.content : (document.querySelector('h1')?.innerText?.trim() || null);
                        if (keywords.length || title) {
                            result = {
                                id: '',
                                title: title,
                                keywords: keywords,
                                category: null,
                                contributor: null,
                                assetType: null,
                                creationDate: null,
                                thumbnailUrl: null
                            };
                        }
                    }
                    if (result && (result.keywords.length > 0 || result.title)) {
                        document.title = "__SCRAPED_JSON__:" + JSON.stringify(result);
                    }
                } catch (e) {
                    document.title = "__SCRAPED_ERR__:" + String(e);
                }
            }
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                attemptExtract();
            }
            window.addEventListener('DOMContentLoaded', attemptExtract);
            window.addEventListener('load', attemptExtract);
            setInterval(attemptExtract, 400);
        })();
    "#;

    let window_label = "adobe_browser_scraper";
    if let Some(existing) = app.get_webview_window(window_label) {
        let _ = existing.close();
    }

    let initial_url = match samples.first() {
        Some(s) => s.url.as_str(),
        None => return,
    };
    let Ok(url_parsed) = initial_url.parse() else {
        return;
    };

    let window =
        match WebviewWindowBuilder::new(app, window_label, WebviewUrl::External(url_parsed))
            .visible(false)
            .focused(false)
            .inner_size(960.0, 680.0)
            .center()
            .title("Metalizer — Adobe Stock Scraper (Live)")
            .initialization_script(script)
            .build()
        {
            Ok(w) => w,
            Err(err) => {
                eprintln!("Error creating scraper WebviewWindow: {:?}", err);
                return;
            }
        };

    let total = samples.len();
    for (index, sample) in samples.iter_mut().enumerate() {
        let current = index + 1;
        progress_cb(
            current,
            total,
            &sample.url,
            sample.title.as_deref(),
            sample.keywords.len(),
        );

        if index > 0 {
            if let Ok(target_url) = sample.url.parse() {
                let _ = window.navigate(target_url);
            }
        }

        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
        while tokio::time::Instant::now() < deadline {
            if let Ok(title) = window.title() {
                if title.starts_with("__SCRAPED_JSON__:") {
                    let json_str = &title["__SCRAPED_JSON__:".len()..];
                    if let Ok(val) = serde_json::from_str::<AdobePreloadedMetadata>(json_str) {
                        if !val.keywords.is_empty() || val.title.is_some() {
                            if sample.title.is_none() {
                                sample.title = val.title;
                            }
                            if sample.keywords.is_empty() {
                                sample.keywords = val.keywords;
                            }
                            if sample.category.is_none() {
                                sample.category = val.category;
                            }
                            if sample.contributor.is_none() {
                                sample.contributor = val.contributor;
                            }
                            if sample.asset_type.is_none() {
                                sample.asset_type = val.asset_type;
                            }
                            if sample.creation_date.is_none() {
                                sample.creation_date = val.creation_date;
                            }
                            if sample.thumbnail_url.is_none() {
                                sample.thumbnail_url = val.thumbnail_url;
                            }
                            break;
                        }
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(350)).await;
        }

        progress_cb(
            current,
            total,
            &sample.url,
            sample.title.as_deref(),
            sample.keywords.len(),
        );
        tokio::time::sleep(Duration::from_millis(1500)).await;
    }

    let _ = window.close();
}

pub fn parse_search_html(
    html: &str,
    limit: usize,
) -> (Vec<AdobePopulationSearchResult>, Vec<String>) {
    let limit = limit.clamp(1, MAX_POPULATION_SAMPLES);
    let apollo_map = extract_apollo_state_metadata(html);
    let anchor_re =
        Regex::new(r#"(?is)<a\b[^>]*\bhref\s*=\s*[\"']([^\"']+)[\"'][^>]*>(.*?)</a\s*>"#)
            .expect("valid Adobe anchor parser regex");
    let direct_re = Regex::new(r#"https?://stock\.adobe\.com/[^\s\"'<>\\]+"#)
        .expect("valid Adobe URL parser regex");
    let mut results = Vec::new();
    let mut seen = HashSet::new();
    let mut warnings = Vec::new();

    for captures in anchor_re.captures_iter(html) {
        let href = captures
            .get(1)
            .map(|value| value.as_str())
            .unwrap_or_default();
        let body = captures
            .get(2)
            .map(|value| value.as_str())
            .unwrap_or_default();
        add_result(
            href,
            Some(body),
            &apollo_map,
            limit,
            &mut results,
            &mut seen,
            &mut warnings,
        );
        if results.len() >= limit {
            break;
        }
    }

    if results.len() < limit {
        for matched in direct_re.find_iter(html) {
            add_result(
                matched.as_str(),
                None,
                &apollo_map,
                limit,
                &mut results,
                &mut seen,
                &mut warnings,
            );
            if results.len() >= limit {
                break;
            }
        }
    }

    if results.len() < limit && !apollo_map.is_empty() {
        for (id, meta) in &apollo_map {
            if results.len() >= limit {
                break;
            }
            let key = format!("asset:{}", id);
            if seen.insert(key) {
                let url = format!("https://stock.adobe.com/images/asset/{}", id);
                results.push(AdobePopulationSearchResult {
                    rank: (results.len() + 1) as u8,
                    url,
                    asset_id: Some(id.clone()),
                    search_title: meta.title.clone(),
                    title: meta.title.clone(),
                    keywords: meta.keywords.clone(),
                    category: meta.category,
                    contributor: meta.contributor.clone(),
                    asset_type: meta.asset_type.clone(),
                    creation_date: meta.creation_date.clone(),
                    thumbnail_url: meta.thumbnail_url.clone(),
                });
            }
        }
    }

    if results.len() < limit {
        warnings.push(format!(
            "Adobe hanya mengembalikan {} sample unik dari target {}",
            results.len(),
            limit
        ));
    }
    (results, warnings)
}

fn add_result(
    raw_href: &str,
    body: Option<&str>,
    apollo_map: &HashMap<String, AdobePreloadedMetadata>,
    limit: usize,
    results: &mut Vec<AdobePopulationSearchResult>,
    seen: &mut HashSet<String>,
    warnings: &mut Vec<String>,
) {
    if results.len() >= limit {
        return;
    }
    let href = decode_html_entities(raw_href).replace("\\/", "/");
    let Ok(url) = normalize_adobe_url(&href) else {
        return;
    };
    let Some(asset_id) = adobe_asset_id(&url) else {
        return;
    };
    let key = format!("asset:{}", asset_id);
    if !seen.insert(key) {
        warnings.push(format!("Duplicate Adobe asset ID {} dilewati", asset_id));
        return;
    }
    let search_title = body.and_then(extract_search_title);
    let preloaded = apollo_map.get(&asset_id);
    let (slug_title, _) = extract_slug_metadata(&url);

    let final_title = preloaded
        .and_then(|p| p.title.clone())
        .or_else(|| search_title.clone())
        .or(slug_title.clone());

    let final_keywords = preloaded.map(|p| p.keywords.clone()).unwrap_or_default();

    results.push(AdobePopulationSearchResult {
        rank: (results.len() + 1) as u8,
        url,
        asset_id: Some(asset_id),
        search_title: search_title.or(slug_title),
        title: final_title,
        keywords: final_keywords,
        category: preloaded.and_then(|p| p.category),
        contributor: preloaded.and_then(|p| p.contributor.clone()),
        asset_type: preloaded.and_then(|p| p.asset_type.clone()),
        creation_date: preloaded.and_then(|p| p.creation_date.clone()),
        thumbnail_url: preloaded.and_then(|p| p.thumbnail_url.clone()),
    });
}

pub fn extract_slug_metadata(url: &str) -> (Option<String>, Vec<String>) {
    let Ok(parsed) = Url::parse(url) else {
        return (None, Vec::new());
    };
    let Some(segments) = parsed.path_segments() else {
        return (None, Vec::new());
    };
    let seg_vec: Vec<&str> = segments.collect();
    if seg_vec.len() < 2 {
        return (None, Vec::new());
    }
    let slug = seg_vec[seg_vec.len() - 2];
    if slug.is_empty()
        || slug == "asset"
        || slug == "images"
        || slug == "video"
        || slug == "templates"
    {
        return (None, Vec::new());
    }

    let raw_words: Vec<&str> = slug.split('-').filter(|w| !w.is_empty()).collect();
    if raw_words.is_empty() {
        return (None, Vec::new());
    }

    let title_words: Vec<String> = raw_words
        .iter()
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect();
    let title = title_words.join(" ");

    let stopwords: HashSet<&str> = [
        "with", "for", "in", "and", "of", "the", "a", "an", "on", "at", "by", "from", "to", "is",
        "it", "as", "or", "into", "onto", "per", "via", "untitled", "design", "elements",
    ]
    .into_iter()
    .collect();

    let mut keywords = Vec::new();
    let mut seen_kw = HashSet::new();

    for window in raw_words.windows(2) {
        if !stopwords.contains(window[0]) && !stopwords.contains(window[1]) {
            let phrase = format!("{} {}", window[0], window[1]);
            if seen_kw.insert(phrase.clone()) {
                keywords.push(phrase);
            }
        }
    }

    for word in &raw_words {
        let clean = word.to_lowercase();
        if clean.len() >= 3 && !stopwords.contains(clean.as_str()) {
            if seen_kw.insert(clean.clone()) {
                keywords.push(clean);
            }
        }
    }

    (Some(title), keywords)
}

fn normalize_adobe_url(raw: &str) -> AppResult<String> {
    let base = Url::parse("https://stock.adobe.com")
        .map_err(|error| AppError::InvalidRequest(error.to_string()))?;
    let url = if raw.starts_with('/') {
        base.join(raw)
            .map_err(|error| AppError::InvalidRequest(error.to_string()))?
    } else {
        Url::parse(raw).map_err(|error| AppError::InvalidRequest(error.to_string()))?
    };
    if url.scheme() != "https" || url.host_str() != Some("stock.adobe.com") {
        return Err(AppError::InvalidRequest(
            "URL bukan halaman Adobe Stock publik".to_string(),
        ));
    }
    let is_asset_page = url
        .path_segments()
        .map(|mut segments| {
            segments
                .any(|segment| matches!(segment, "images" | "video" | "templates" | "3d-assets"))
        })
        .unwrap_or(false);
    if !is_asset_page {
        return Err(AppError::InvalidRequest(
            "URL bukan detail asset Adobe Stock".to_string(),
        ));
    }
    Ok(url.to_string())
}

fn adobe_asset_id(url: &str) -> Option<String> {
    Url::parse(url)
        .ok()?
        .path_segments()?
        .rev()
        .find(|segment| {
            !segment.is_empty() && segment.chars().all(|character| character.is_ascii_digit())
        })
        .map(str::to_string)
}

fn extract_search_title(body: &str) -> Option<String> {
    let tag_re = Regex::new(r"(?is)<[^>]+>").expect("valid HTML tag regex");
    let title = tag_re.replace_all(body, " ");
    let title = decode_html_entities(&title);
    let title = title.split_whitespace().collect::<Vec<_>>().join(" ");
    if title.is_empty() || title.len() > 300 {
        None
    } else {
        Some(title)
    }
}

#[allow(dead_code)]
fn strip_html_tags(value: &str) -> String {
    let tag_re = Regex::new(r"(?is)<[^>]+>").expect("valid HTML tag regex");
    let stripped = tag_re.replace_all(value, " ");
    let decoded = decode_html_entities(&stripped);
    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn decode_html_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(query: &str, asset_type: &str, sort: &str) -> AdobePopulationSearchRequest {
        AdobePopulationSearchRequest {
            asset_id: "asset-1".to_string(),
            query: query.to_string(),
            locale: "uk".to_string(),
            asset_type: asset_type.to_string(),
            sort: sort.to_string(),
            limit: 20,
        }
    }

    #[test]
    fn search_url_encodes_query_and_uses_supported_order_and_filter() {
        let url = build_search_url(&request("capybara icon set", "vector", "relevance")).unwrap();
        assert!(url.contains("/uk/search/images?"));
        assert!(url.contains("k=capybara+icon+set"));
        assert!(url.contains("order=relevance"));
        assert!(url.contains("filters%5Bcontent_type%3Azip_vector%5D=1"));
        assert!(url.contains("filters%5Bcontent_type%3Aphoto%5D=0"));
        assert!(url.contains("search_type=filter-select"));
        assert!(url.contains("get_facets=1"));
        assert!(!url.contains("nb_relevance"));
    }

    #[test]
    fn parser_caps_results_and_deduplicates_asset_ids() {
        let html = r#"
          <a href="/uk/images/capybara-icon/123"><span>Capybara icon</span></a>
          <a href="https://stock.adobe.com/uk/images/other/123">duplicate</a>
          <a href="/uk/images/second/456">Second</a>
        "#;
        let (results, warnings) = parse_search_html(html, 20);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].rank, 1);
        assert_eq!(results[1].rank, 2);
        assert!(warnings.iter().any(|warning| warning.contains("Duplicate")));
    }

    #[test]
    fn parser_extracts_apollo_vector_metadata_keywords() {
        let html = r#"
          <script>
            window.__CLIENT_CONFIG__ = {
              "ROOT_QUERY": {},
              "VectorMetadata:110641542": {
                "_id": 110641542,
                "title": "Red Shrimp Vector Illustration",
                "assetType": "vector",
                "category": 8,
                "contributor": "Seafood Artist",
                "keywords": ["shrimp", "prawn", "seafood", "crustacean", "vector"],
                "thumbnail1000": "https://stock.adobe.com/thumb/110641542.jpg",
                "creationDate": "2024-05-12"
              }
            };
          </script>
          <a href="/uk/images/red-shrimp/110641542"><span>Red Shrimp</span></a>
        "#;
        let (results, _) = parse_search_html(html, 20);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].asset_id.as_deref(), Some("110641542"));
        assert_eq!(
            results[0].title.as_deref(),
            Some("Red Shrimp Vector Illustration")
        );
        assert_eq!(
            results[0].keywords,
            vec!["shrimp", "prawn", "seafood", "crustacean", "vector"]
        );
        assert_eq!(results[0].category, Some(8));
        assert_eq!(results[0].contributor.as_deref(), Some("Seafood Artist"));
        assert_eq!(results[0].asset_type.as_deref(), Some("vector"));
    }

    #[test]
    fn query_is_limited_to_three_words() {
        assert!(
            validate_search_request(&request("capybara icon set", "vector", "relevance")).is_ok()
        );
        assert!(validate_search_request(&request(
            "capybara icon set black",
            "vector",
            "relevance"
        ))
        .is_err());
    }
}
