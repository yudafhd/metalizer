import type { MetadataWarning, StockAsset, StockMetadata, ValidationResult } from "../types";

export const IDEAL_KEYWORD_MIN = 20;
export const IDEAL_KEYWORD_MAX = 35;

const LOW_VALUE_KEYWORDS = new Set([
  "best",
  "amazing",
  "beautiful",
  "fantastic",
  "free",
  "hd",
  "4k",
  "premium",
  "trending",
  "viral",
  "sale",
  "buy now",
  "click here",
]);

const TRADEMARK_KEYWORDS = new Set([
  "adobe",
  "adidas",
  "amazon",
  "chatgpt",
  "coca cola",
  "disney",
  "facebook",
  "gemini",
  "google",
  "instagram",
  "iphone",
  "ipad",
  "kfc",
  "lego",
  "mcdonalds",
  "microsoft",
  "netflix",
  "nike",
  "pepsi",
  "photoshop",
  "pinterest",
  "samsung",
  "starbucks",
  "tesla",
  "twitter",
  "youtube",
]);

function isUnsafeKeyword(keyword: string): boolean {
  const lower = keyword.toLowerCase();
  return /[™®]/.test(keyword) || LOW_VALUE_KEYWORDS.has(lower) || TRADEMARK_KEYWORDS.has(lower);
}

export function normalizeKeywords(raw: string[], filename: string, maximum = 49): string[] {
  const filenameStem = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim().toLowerCase();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of raw) {
    const keyword = value.trim().replace(/\s+/g, " ");
    const lower = keyword.toLowerCase();
    if (
      !keyword ||
      seen.has(lower) ||
      lower === filenameStem ||
      lower.includes(".jpg") ||
      lower.includes(".jpeg") ||
      lower.includes(".png") ||
      lower.includes(".webp") ||
      isUnsafeKeyword(keyword)
    ) {
      continue;
    }
    seen.add(lower);
    result.push(keyword);
    if (result.length >= maximum) break;
  }
  return result;
}

export function prioritizeKeywords(keywords: string[], title: string): string[] {
  const titleWords = new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
  return keywords
    .map((keyword, index) => ({ keyword, index, score: keyword.toLowerCase().split(/\s+/).filter((word) => titleWords.has(word)).length }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ keyword }) => keyword);
}

export function validateMetadata(
  filename: string,
  metadata: Pick<StockMetadata, "title" | "keywords" | "category">,
  maximumKeywords = 49,
): ValidationResult {
  const warnings: MetadataWarning[] = [];
  const title = metadata.title.trim();
  if (!title) warnings.push({ code: "title-required", message: "Title wajib diisi", severity: "error" });
  if (title.length > 70) warnings.push({ code: "title-too-long", message: "Title lebih dari 70 karakter", severity: "error" });
  if (/\r|\n/.test(title)) warnings.push({ code: "title-line-break", message: "Title harus satu baris", severity: "error" });
  const titleWordCount = title ? title.split(/\s+/).length : 0;
  if (title && (titleWordCount < 5 || titleWordCount > 10)) warnings.push({ code: "title-word-count", message: "Title sebaiknya terdiri dari 5–10 kata yang natural", severity: "warning" });
  const filenameStem = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim().toLowerCase();
  if (filenameStem && title.toLowerCase().includes(filenameStem)) warnings.push({ code: "title-filename", message: "Title masih memuat nama file asli", severity: "warning" });
  const normalizedKeywords = normalizeKeywords(metadata.keywords, filename, maximumKeywords);
  if (!normalizedKeywords.length) warnings.push({ code: "keywords-required", message: "Minimal satu keyword wajib diisi", severity: "error" });
  if (normalizedKeywords.length < 10) warnings.push({ code: "keywords-low", message: "Keyword kurang dari 10; hasil pencarian mungkin kurang mudah ditemukan", severity: "warning" });
  if (normalizedKeywords.length < IDEAL_KEYWORD_MIN) warnings.push({ code: "keywords-ideal-low", message: `Sebaiknya gunakan ${IDEAL_KEYWORD_MIN}–${IDEAL_KEYWORD_MAX} keyword yang benar-benar relevan`, severity: "warning" });
  if (normalizedKeywords.length > IDEAL_KEYWORD_MAX && normalizedKeywords.length <= maximumKeywords) warnings.push({ code: "keywords-ideal-high", message: `Keyword lebih dari ${IDEAL_KEYWORD_MAX}; hapus yang paling umum atau kurang relevan`, severity: "warning" });
  if (metadata.keywords.length > maximumKeywords) warnings.push({ code: "keywords-limit", message: `Keyword lebih dari ${maximumKeywords}; sisanya akan dihapus saat export`, severity: "warning" });
  if (new Set(metadata.keywords.map((keyword) => keyword.trim().toLowerCase())).size !== metadata.keywords.length) {
    warnings.push({ code: "keywords-duplicate", message: "Ada keyword yang sama", severity: "warning" });
  }
  if (metadata.category < 1 || metadata.category > 21) warnings.push({ code: "category-invalid", message: "Pilih kategori Adobe Stock yang valid", severity: "error" });
  return { valid: !warnings.some((warning) => warning.severity === "error"), warnings, normalizedKeywords };
}

export function qualityScore(metadata: Pick<StockMetadata, "title" | "keywords" | "category">, validation: ValidationResult): number {
  const titleQuality = metadata.title.trim() && metadata.title.length <= 70 ? 20 : 0;
  const keywordCount = metadata.keywords.length >= IDEAL_KEYWORD_MIN && metadata.keywords.length <= IDEAL_KEYWORD_MAX ? 10 : metadata.keywords.length >= 10 ? 7 : 0;
  const uniqueRatio = metadata.keywords.length ? new Set(metadata.keywords.map((keyword) => keyword.toLowerCase())).size / metadata.keywords.length : 0;
  const uniqueness = Math.round(uniqueRatio * 15);
  const firstTen = metadata.keywords.length >= 10 ? 25 : Math.round((metadata.keywords.length * 25) / 10);
  const category = metadata.category >= 1 && metadata.category <= 21 ? 10 : 0;
  const completeness = metadata.title.trim() && metadata.keywords.length ? 10 : 0;
  const safety = validation.valid ? 10 : 3;
  return Math.max(0, Math.min(100, titleQuality + keywordCount + uniqueness + firstTen + category + completeness + safety));
}

export function metadataLabel(score: number): string {
  if (score >= 90) return "Sangat bagus";
  if (score >= 75) return "Bagus";
  if (score >= 55) return "Perlu dicek";
  return "Belum lengkap";
}

export function emptyMetadata(asset: StockAsset, mode: StockMetadata["metadataMode"]): StockMetadata {
  return {
    assetId: asset.id,
    title: "",
    keywords: [],
    category: 8,
    qualityScore: 0,
    warnings: [],
    aiGenerated: false,
    metadataMode: mode,
    contentSource: "standard",
  };
}
