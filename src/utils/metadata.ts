import type { MetadataWarning, StockAsset, StockMetadata, ValidationResult } from "../types";

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
      lower.includes(".webp")
    ) {
      continue;
    }
    seen.add(lower);
    result.push(keyword);
    if (result.length >= maximum) break;
  }
  return result;
}

export function validateMetadata(
  filename: string,
  metadata: Pick<StockMetadata, "title" | "keywords" | "category">,
  maximumKeywords = 49,
): ValidationResult {
  const warnings: MetadataWarning[] = [];
  const title = metadata.title.trim();
  if (!title) warnings.push({ code: "title-required", message: "Title is required", severity: "error" });
  if (title.length > 70) warnings.push({ code: "title-too-long", message: "Title exceeds 70 characters", severity: "error" });
  if (/\r|\n/.test(title)) warnings.push({ code: "title-line-break", message: "Title must be one line", severity: "error" });
  const filenameStem = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim().toLowerCase();
  if (filenameStem && title.toLowerCase().includes(filenameStem)) warnings.push({ code: "title-filename", message: "Title contains the original filename", severity: "warning" });
  const normalizedKeywords = normalizeKeywords(metadata.keywords, filename, maximumKeywords);
  if (!normalizedKeywords.length) warnings.push({ code: "keywords-required", message: "At least one keyword is required", severity: "error" });
  if (normalizedKeywords.length < 10) warnings.push({ code: "keywords-low", message: "Fewer than 10 keywords; review discoverability", severity: "warning" });
  if (metadata.keywords.length > maximumKeywords) warnings.push({ code: "keywords-limit", message: `More than ${maximumKeywords} keywords; extra keywords will be removed on export`, severity: "warning" });
  if (new Set(metadata.keywords.map((keyword) => keyword.trim().toLowerCase())).size !== metadata.keywords.length) {
    warnings.push({ code: "keywords-duplicate", message: "Duplicate keywords were found", severity: "warning" });
  }
  if (metadata.category < 1 || metadata.category > 21) warnings.push({ code: "category-invalid", message: "Select a valid Adobe Stock category", severity: "error" });
  return { valid: !warnings.some((warning) => warning.severity === "error"), warnings, normalizedKeywords };
}

export function qualityScore(metadata: Pick<StockMetadata, "title" | "keywords" | "category">, validation: ValidationResult): number {
  const titleQuality = metadata.title.trim() && metadata.title.length <= 70 ? 20 : 0;
  const keywordCount = metadata.keywords.length >= 30 && metadata.keywords.length <= 45 ? 10 : metadata.keywords.length >= 20 ? 7 : metadata.keywords.length >= 10 ? 4 : 0;
  const uniqueRatio = metadata.keywords.length ? new Set(metadata.keywords.map((keyword) => keyword.toLowerCase())).size / metadata.keywords.length : 0;
  const uniqueness = Math.round(uniqueRatio * 15);
  const firstTen = metadata.keywords.length >= 10 ? 25 : Math.round((metadata.keywords.length * 25) / 10);
  const category = metadata.category >= 1 && metadata.category <= 21 ? 10 : 0;
  const completeness = metadata.title.trim() && metadata.keywords.length ? 10 : 0;
  const safety = validation.valid ? 10 : 3;
  return Math.max(0, Math.min(100, titleQuality + keywordCount + uniqueness + firstTen + category + completeness + safety));
}

export function metadataLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 55) return "Needs Review";
  return "Incomplete";
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
