import type {
  AdobePopulationAssetType,
  AdobePopulationResearch,
  AdobePopulationSample,
  AdobePopulationSearchResult,
  AdobePopulationSort,
  InitialCandidate,
  PopulationKeyword,
  PopulationTitleSource,
} from "../types";

export const MAX_POPULATION_SAMPLES = 20;

export function validatePopulationQuery(query: string): boolean {
  const words = query.trim().split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 3 && words.every((word) => /^[a-z-]+$/i.test(word));
}

export function buildAdobeSearchUrl(query: string, locale: string, assetType: AdobePopulationAssetType, sort: AdobePopulationSort): string {
  if (!validatePopulationQuery(query)) throw new Error("Search query harus berisi 1-3 kata Inggris");
  const url = new URL(`https://stock.adobe.com/${encodeURIComponent(locale.trim())}/search/images`);
  const params = new URLSearchParams();
  const allImageTypes = assetType === "image";
  for (const [type, enabled] of [
    ["photo", allImageTypes || assetType === "photo"],
    ["illustration", allImageTypes || assetType === "illustration"],
    ["zip_vector", allImageTypes || assetType === "vector"],
  ] as const) {
    params.set(`filters[content_type:${type}]`, enabled ? "1" : "0");
  }
  for (const type of ["video", "template", "3d", "audio"]) {
    params.set(`filters[content_type:${type}]`, "0");
  }
  params.set("filters[content_type:image]", "1");
  params.set("filters[include_stock_enterprise]", "0");
  params.set("filters[is_editorial]", "0");
  params.set("filters[free_collection]", "0");
  params.set("filters[globally_safe_collection]", "1");
  params.set("k", query.trim());
  params.set("order", sort);
  params.set("search_type", "filter-select");
  params.set("get_facets", "1");
  url.search = params.toString();
  return url.toString();
}

export function limitPopulationSamples(samples: AdobePopulationSample[], limit = MAX_POPULATION_SAMPLES): AdobePopulationSample[] {
  const seen = new Set<string>();
  return samples
    .slice()
    .sort((left, right) => left.sampleRank - right.sampleRank)
    .filter((sample) => {
      const key = sample.assetId ? `asset:${sample.assetId}` : `url:${sample.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.min(MAX_POPULATION_SAMPLES, Math.max(1, limit)));
}

export function rankPopulationSamples(samples: AdobePopulationSample[], creationResults: AdobePopulationSearchResult[]): AdobePopulationSample[] {
  const ranks = new Map<string, number>();
  for (const result of creationResults) {
    if (result.assetId && !ranks.has(result.assetId)) ranks.set(result.assetId, result.rank);
  }
  const populationSize = Math.max(1, creationResults.length);
  return samples.map((sample) => {
    const creationRank = sample.assetId ? ranks.get(sample.assetId) : undefined;
    if (!creationRank) {
      return { ...sample, creationRank: undefined, freshnessScore: undefined, estimatedMonth: null, estimatedYear: null, dateSource: undefined, dateConfidence: 0 };
    }
    const freshnessScore = populationSize === 1 ? 100 : Math.round(((populationSize - Math.min(creationRank, populationSize)) / (populationSize - 1)) * 1000) / 10;
    return { ...sample, creationRank, freshnessScore, estimatedMonth: null, estimatedYear: null, dateSource: "relative_creation_order", dateConfidence: 0 };
  });
}

export function aggregatePopulationKeywords(samples: AdobePopulationSample[], visualFacts: string[]): PopulationKeyword[] {
  const extracted = samples.filter((sample) => sample.metadataStatus === "extracted");
  const totalSamples = Math.max(1, extracted.length);
  const facts = visualFacts.map(normalizeKeyword);
  const buckets = new Map<string, { keyword: string; ranks: number[]; positions: number[] }>();
  for (const sample of extracted) {
    const seen = new Set<string>();
    sample.keywords.forEach((keyword, index) => {
      const normalized = normalizeKeyword(keyword);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      const bucket = buckets.get(normalized) ?? { keyword: keyword.trim(), ranks: [], positions: [] };
      bucket.ranks.push(sample.sampleRank);
      bucket.positions.push(index + 1);
      buckets.set(normalized, bucket);
    });
  }
  return [...buckets.entries()]
    .map(([normalizedKeyword, bucket]) => {
      const frequency = bucket.ranks.length;
      const averageSampleRank = average(bucket.ranks);
      const averageKeywordPosition = average(bucket.positions);
      const supportedByInput = facts.some((fact) => fact === normalizedKeyword || fact.split(" ").includes(normalizedKeyword) || normalizedKeyword.split(" ").every((term) => fact.split(" ").includes(term)));
      const semanticMatch = supportedByInput ? 1 : 0;
      const distinctivenessAdjustment = frequency === totalSamples && frequency > 1 ? 0.8 : frequency <= 2 ? 1.1 : 1;
      const candidateRankWeight = average(bucket.ranks.map((rank) => (21 - Math.min(rank, 20)) / 20));
      const keywordPositionWeight = average(bucket.positions.map((position) => (position <= 10 ? 1 : 0.55)));
      const searchRelevanceWeight = Math.max(0.8, Math.min(1, 1 - ((averageSampleRank - 1) / 20) * 0.2));
      const populationScore = supportedByInput
        ? roundOneDecimal((frequency / totalSamples) * candidateRankWeight * keywordPositionWeight * searchRelevanceWeight * semanticMatch * distinctivenessAdjustment * 100)
        : 0;
      return {
        keyword: bucket.keyword,
        normalizedKeyword,
        group: classifyGroup(normalizedKeyword, facts),
        frequency,
        sampleCount: frequency,
        bestSampleRank: Math.min(...bucket.ranks),
        averageSampleRank: roundOneDecimal(averageSampleRank),
        bestKeywordPosition: Math.min(...bucket.positions),
        averageKeywordPosition: roundOneDecimal(averageKeywordPosition),
        semanticMatch,
        distinctivenessAdjustment,
        populationScore,
        supportedByInput,
      } satisfies PopulationKeyword;
    })
    .sort((left, right) => right.populationScore - left.populationScore || right.frequency - left.frequency || left.bestKeywordPosition - right.bestKeywordPosition);
}

export function isPopulationResearchStale(research: AdobePopulationResearch, query: string, locale: string, assetType: AdobePopulationAssetType, sort: AdobePopulationSort): boolean {
  return research.stale || research.query !== query.trim() || research.locale !== locale || research.assetType !== assetType || research.sort !== sort;
}

export function selectPopulationTitle(source: Exclude<PopulationTitleSource, null>, candidate: InitialCandidate, research: AdobePopulationResearch, currentTitle: string): string {
  if (source === "initial") return candidate.initialTitle;
  if (source === "population") return research.recommendationTitleFromPopulation ?? currentTitle;
  return currentTitle;
}

export function markUnavailableSample(sample: AdobePopulationSample, reason: string): AdobePopulationSample {
  return {
    ...sample,
    title: undefined,
    keywords: [],
    category: undefined,
    contributor: undefined,
    assetType: undefined,
    creationDate: undefined,
    metadataStatus: "unavailable",
    extractionError: reason,
  };
}

export function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function classifyGroup(keyword: string, facts: string[]): PopulationKeyword["group"] {
  if (facts[0] === keyword || facts[0]?.split(" ").includes(keyword)) return "primary_subject";
  if (["icon", "set", "collection", "logo", "template", "background", "banner", "isolated"].some((term) => keyword === term || keyword.split(" ").includes(term))) return "asset_type_function";
  if (["silhouette", "minimal", "flat", "outline", "line art", "black", "white", "vector", "illustration", "photo", "3d", "realistic"].some((term) => keyword === term || keyword.split(" ").includes(term))) return "visual_style_format";
  if (["christmas", "wedding", "birthday", "holiday", "ramadan", "easter", "new year", "valentine"].some((term) => keyword === term)) return "event_context";
  if (["marketing", "advertising", "business", "education", "social media", "presentation"].some((term) => keyword === term || keyword.split(" ").includes(term))) return "commercial_use";
  if (facts.some((fact) => fact === keyword || fact.split(" ").includes(keyword))) return "visible_details";
  return "other";
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
