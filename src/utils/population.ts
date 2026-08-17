import type {
  AdobePopulationAssetType,
  AdobePopulationResearch,
  AdobePopulationSample,
  AdobePopulationSearchResult,
  AdobePopulationSort,
  InitialCandidate,
  PopulationKeyword,
  PopulationCohort,
  PopulationConfidenceLabel,
  PopulationTitleSelection,
  PopulationTitleScore,
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
  const facts = visualFacts.map(normalizeKeyword).filter(Boolean);
  const buckets = new Map<string, { keyword: string; occurrences: { rank: number; position: number; cohort: PopulationCohort; freshnessScore?: number }[] }>();
  for (const sample of extracted) {
    const seen = new Set<string>();
    sample.keywords.forEach((keyword, index) => {
      const normalized = normalizeKeyword(keyword);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      const bucket = buckets.get(normalized) ?? { keyword: keyword.trim(), occurrences: [] };
      bucket.occurrences.push({
        rank: sample.sampleRank,
        position: index + 1,
        cohort: sample.sourceCohort ?? "relevance",
        freshnessScore: sample.freshnessScore,
      });
      buckets.set(normalized, bucket);
    });
  }
  const availableCohorts = new Set<PopulationCohort>(extracted.map((sample) => sample.sourceCohort ?? "relevance"));
  if (extracted.some((sample) => sample.freshnessScore !== undefined)) availableCohorts.add("freshness");
  return [...buckets.entries()]
    .map(([normalizedKeyword, bucket]) => {
      const frequency = bucket.occurrences.length;
      const ranks = bucket.occurrences.map((occurrence) => occurrence.rank);
      const positions = bucket.occurrences.map((occurrence) => occurrence.position);
      const averageSampleRank = average(ranks);
      const averageKeywordPosition = average(positions);
      const imageSemanticFit = semanticFit(normalizedKeyword, facts);
      const supportedByInput = imageSemanticFit >= 0.5;
      const distinctivenessAdjustment = frequency === totalSamples && frequency > 1 ? 0.8 : frequency <= 2 ? 1.1 : 1;
      const maxRelevanceWeight = extracted.reduce((sum, sample) => sum + rankWeight(sample.sampleRank), 0) || 1;
      const relevanceScore = clamp(bucket.occurrences.reduce((sum, occurrence) => sum + rankWeight(occurrence.rank) * positionWeight(occurrence.position), 0) / maxRelevanceWeight);
      const positionScore = average(bucket.occurrences.map((occurrence) => positionWeight(occurrence.position)));
      const topTenFrequency = bucket.occurrences.filter((occurrence) => occurrence.position <= 10).length / Math.max(1, frequency);
      const visualNeighborScore = cohortScore(bucket.occurrences, extracted, "visual_neighbors");
      const commercialScore = cohortScore(bucket.occurrences, extracted, "downloads");
      const featuredScore = cohortScore(bucket.occurrences, extracted, "featured");
      const undiscoveredScore = cohortScore(bucket.occurrences, extracted, "undiscovered");
      const freshnessScore = freshnessSignal(bucket.occurrences, extracted);
      const featuredAvailable = availableCohorts.has("featured");
      const rawScore = weightedFeatureScore(imageSemanticFit, relevanceScore, visualNeighborScore, commercialScore, freshnessScore, featuredScore, featuredAvailable, availableCohorts);
      const irrelevancePenalty = imageSemanticFit <= 0 ? 1 : imageSemanticFit < 0.75 ? 0.5 : 0;
      const duplicationPenalty = 0;
      const genericSaturationPenalty = frequency === totalSamples && isGenericSaturatedTerm(normalizedKeyword) ? 0.25 : 0;
      const unsupportedContentPenalty = imageSemanticFit <= 0 ? 1 : 0;
      const finalScore = imageSemanticFit <= 0
        ? 0
        : clamp(rawScore - 0.15 * irrelevancePenalty - 0.1 * duplicationPenalty - 0.1 * genericSaturationPenalty - 0.2 * unsupportedContentPenalty);
      const evidenceCohorts = [...new Set(bucket.occurrences.map((occurrence) => occurrence.cohort))];
      return {
        keyword: bucket.keyword,
        normalizedKeyword,
        group: classifyGroup(normalizedKeyword, facts),
        frequency,
        sampleCount: frequency,
        bestSampleRank: Math.min(...ranks),
        averageSampleRank: roundOneDecimal(averageSampleRank),
        bestKeywordPosition: Math.min(...positions),
        averageKeywordPosition: roundOneDecimal(averageKeywordPosition),
        semanticMatch: imageSemanticFit,
        distinctivenessAdjustment,
        populationScore: roundOneDecimal(finalScore * 100),
        supportedByInput,
        imageSemanticFit,
        relevanceScore,
        visualNeighborScore,
        commercialScore,
        freshnessScore,
        featuredScore,
        undiscoveredScore,
        positionScore,
        topTenFrequency,
        finalScore,
        evidence: {
          imageSemanticFit,
          relevanceScore,
          visualNeighborScore,
          commercialScore,
          freshnessScore,
          featuredScore,
          undiscoveredScore,
          positionScore,
          topTenFrequency,
          irrelevancePenalty,
          duplicationPenalty,
          genericSaturationPenalty,
          unsupportedContentPenalty,
          cohorts: evidenceCohorts,
        },
      } satisfies PopulationKeyword;
    })
    .sort((left, right) => (right.finalScore ?? 0) - (left.finalScore ?? 0) || right.frequency - left.frequency || left.bestKeywordPosition - right.bestKeywordPosition);
}

export function isPopulationResearchStale(research: AdobePopulationResearch, query: string, locale: string, assetType: AdobePopulationAssetType, sort: AdobePopulationSort, sampleLimit?: number): boolean {
  return research.stale || research.query !== query.trim() || research.locale !== locale || research.assetType !== assetType || research.sort !== sort || (sampleLimit !== undefined && research.sampleLimit !== sampleLimit);
}

const GROUP_ORDER: Record<PopulationKeyword["group"], number> = {
  primary_subject: 0,
  visible_details: 1,
  asset_type_function: 2,
  visual_style_format: 3,
  event_context: 4,
  commercial_use: 5,
  other: 6,
};

export function selectFinalPopulationKeywords(keywords: PopulationKeyword[], title: string, maximum = 35): PopulationKeyword[] {
  const eligible = keywords.filter((keyword) => keyword.supportedByInput && (keyword.finalScore ?? keyword.populationScore / 100) > 0);
  const titleText = normalizeKeyword(title);
  return eligible
    .slice()
    .sort((left, right) => {
      const leftTitle = titleText.includes(left.normalizedKeyword) ? 1 : 0;
      const rightTitle = titleText.includes(right.normalizedKeyword) ? 1 : 0;
      return rightTitle - leftTitle
        || GROUP_ORDER[left.group] - GROUP_ORDER[right.group]
        || (right.finalScore ?? right.populationScore / 100) - (left.finalScore ?? left.populationScore / 100)
        || left.bestKeywordPosition - right.bestKeywordPosition;
    })
    .slice(0, Math.min(49, Math.max(1, maximum)));
}

export function calculatePopulationConfidence(
  samples: AdobePopulationSample[],
  keywords: PopulationKeyword[],
  title: string,
): { score: number; label: PopulationConfidenceLabel; extractionCoverage: number } {
  const extracted = samples.filter((sample) => sample.metadataStatus === "extracted");
  const extractionCoverage = samples.length ? extracted.length / samples.length : 0;
  const sampleCoverage = clamp(extracted.length / 20);
  const imageMetadataAgreement = keywords.length ? average(keywords.map((keyword) => keyword.imageSemanticFit ?? keyword.semanticMatch)) : 0;
  const titleKeywordAlignment = keywords.length
    ? keywords.slice(0, 10).filter((keyword) => normalizeKeyword(title).includes(keyword.normalizedKeyword)).length / Math.min(10, keywords.length)
    : 0;
  const cohortSet = new Set(extracted.map((sample) => sample.sourceCohort ?? "relevance"));
  const cohortConsistency = cohortSet.size <= 1 ? (extracted.length >= 10 ? 0.75 : 0.5) : 0.9;
  const originalitySafety = 1;
  const score = clamp(0.3 * sampleCoverage + 0.25 * imageMetadataAgreement + 0.2 * titleKeywordAlignment + 0.15 * cohortConsistency + 0.1 * originalitySafety);
  const label: PopulationConfidenceLabel = extracted.length < 5 ? "insufficient" : extracted.length < 20 ? "limited" : score >= 0.78 ? "high" : "medium";
  return { score: roundTwoDecimals(score), label, extractionCoverage: roundTwoDecimals(extractionCoverage) };
}

export function scorePopulationTitle(
  title: string,
  candidate: InitialCandidate,
  samples: AdobePopulationSample[],
  populationKeywords: PopulationKeyword[] = [],
): PopulationTitleScore {
  const normalizedTitle = normalizeKeyword(title);
  const titleWords = normalizedTitle.split(" ").filter(Boolean);
  const visualFacts = candidate.visualFacts.map(normalizeKeyword).filter(Boolean);
  const queryTerms = [...new Set([...candidate.searchTerms, ...candidate.searchQuery.split(/\s+/)].map(normalizeKeyword).filter(Boolean))];
  const imageMatches = visualFacts.filter((fact) => normalizedTitle.includes(fact) || fact.split(" ").some((term) => titleWords.includes(term))).length;
  const queryMatches = queryTerms.filter((term) => normalizedTitle.includes(term)).length;
  const assetIntentTerms = [candidate.assetType, candidate.visualStyle, "vector", "illustration", "photo", "pattern", "banner", "icon", "background", "set", "poster", "card"].map((value) => normalizeKeyword(value ?? "")).filter(Boolean);
  const buyerIntentClarity = assetIntentTerms.some((term) => normalizedTitle.includes(term)) ? 1 : 0.35;
  const sampleTitles = samples.map((sample) => normalizeKeyword(sample.title ?? sample.searchTitle ?? "")).filter(Boolean);
  const maximumTitleSimilarity = sampleTitles.reduce((maximum, sampleTitle) => Math.max(maximum, jaccardSimilarity(titleWords, sampleTitle.split(" "))), 0);
  const originality = clamp(1 - maximumTitleSimilarity);
  const samplePatternFit = sampleTitles.length ? clamp(0.55 + (titleWords.length >= 5 && titleWords.length <= 10 ? 0.25 : 0) + (buyerIntentClarity > 0.5 ? 0.2 : 0)) : 0.5;
  const imageAccuracy = visualFacts.length ? clamp(imageMatches / Math.min(3, visualFacts.length)) : 0.5;
  const queryCoverage = queryTerms.length ? clamp(queryMatches / queryTerms.length) : 0.5;
  const supportedPopulationKeywords = populationKeywords
    .filter((keyword) => keyword.supportedByInput && (keyword.finalScore ?? keyword.populationScore / 100) > 0)
    .slice(0, 12);
  const populationKeywordCoverage = supportedPopulationKeywords.length
    ? clamp(
        supportedPopulationKeywords.reduce((sum, keyword) => {
          const weight = keyword.finalScore ?? keyword.populationScore / 100;
          return sum + (normalizedTitle.includes(keyword.normalizedKeyword) ? weight : 0);
        }, 0) /
          (supportedPopulationKeywords.reduce((sum, keyword) => sum + (keyword.finalScore ?? keyword.populationScore / 100), 0) || 1),
      )
    : 0.5;
  const unsupportedTerms = ["3d", "transparent", "editable", "premium", "luxury", "realistic", "isolated"].filter((term) => normalizedTitle.includes(term) && !visualFacts.some((fact) => fact.includes(term)) && !normalizeKeyword(candidate.visualStyle ?? "").includes(term));
  const repeatedWordPenalty = new Set(titleWords).size < titleWords.length ? 0.1 : 0;
  const lengthPenalty = !normalizedTitle ? 1 : title.length > 70 ? 1 : title.length < 35 || title.length > 65 ? 0.08 : 0;
  const stuffingPenalty = titleWords.length > 12 ? 0.15 : repeatedWordPenalty;
  const total = clamp(
    0.3 * imageAccuracy
      + 0.2 * queryCoverage
      + 0.15 * populationKeywordCoverage
      + 0.15 * samplePatternFit
      + 0.1 * buyerIntentClarity
      + 0.1 * originality
      - 0.2 * unsupportedTerms.length
      - stuffingPenalty
      - lengthPenalty,
  );
  const warnings = [
    ...(title.length > 70 ? ["Title melebihi batas 70 karakter."] : []),
    ...(unsupportedTerms.length ? [`Atribut unsupported: ${unsupportedTerms.join(", ")}.`] : []),
    ...(maximumTitleSimilarity >= 0.75 ? ["Title terlalu mirip dengan sample population."] : []),
    ...(queryCoverage < 0.5 ? ["Konsep utama query belum cukup terwakili di title."] : []),
  ];
  return {
    imageAccuracy: roundTwoDecimals(imageAccuracy),
    queryCoverage: roundTwoDecimals(queryCoverage),
    populationKeywordCoverage: roundTwoDecimals(populationKeywordCoverage),
    samplePatternFit: roundTwoDecimals(samplePatternFit),
    buyerIntentClarity: roundTwoDecimals(buyerIntentClarity),
    originality: roundTwoDecimals(originality),
    total: roundTwoDecimals(total),
    warnings,
  };
}

export function selectAutomatedPopulationTitle(
  candidate: InitialCandidate,
  populationTitle: string | undefined,
  samples: AdobePopulationSample[],
  populationKeywords: PopulationKeyword[],
  currentTitle?: string,
): PopulationTitleSelection {
  const candidates: Array<{ source: Exclude<PopulationTitleSource, null>; title: string; priority: number }> = [
    { source: "initial", title: candidate.initialTitle, priority: 2 },
  ];
  if (populationTitle?.trim()) candidates.push({ source: "population", title: populationTitle, priority: 3 });
  if (currentTitle?.trim() && normalizeKeyword(currentTitle) !== normalizeKeyword(candidate.initialTitle)) {
    candidates.push({ source: "custom", title: currentTitle, priority: 1 });
  }

  const scored = candidates
    .map((item) => {
      const title = normalizeAutomatedTitle(item.title);
      return title ? { ...item, title, score: scorePopulationTitle(title, candidate, samples, populationKeywords) } : null;
    })
    .filter((item): item is { source: Exclude<PopulationTitleSource, null>; title: string; priority: number; score: PopulationTitleScore } => Boolean(item));
  const winner = scored.sort((left, right) => right.score.total - left.score.total || right.priority - left.priority || left.title.length - right.title.length)[0];
  if (!winner) {
    const fallbackTitle = normalizeAutomatedTitle(candidate.initialTitle) || "Stock asset illustration";
    return {
      source: "initial",
      title: fallbackTitle,
      score: scorePopulationTitle(fallbackTitle, candidate, samples, populationKeywords),
      rationale: ["Tidak ada kandidat judul valid; memakai fallback berbasis kandidat awal."],
    };
  }

  const rationale = [
    `${winner.source === "population" ? "Judul population" : winner.source === "initial" ? "Judul kandidat awal" : "Judul saat ini"} memperoleh skor tertinggi (${Math.round(winner.score.total * 100)}%).`,
    `Image truth ${Math.round(winner.score.imageAccuracy * 100)}%, query ${Math.round(winner.score.queryCoverage * 100)}%, population keyword ${Math.round((winner.score.populationKeywordCoverage ?? 0.5) * 100)}%.`,
  ];
  if (winner.score.warnings.length) rationale.push(`Guardrail: ${winner.score.warnings[0]}`);
  return { source: winner.source, title: winner.title, score: winner.score, rationale };
}

function normalizeAutomatedTitle(title: string): string {
  const normalized = title
    .replace(/[\r\n]+/g, " ")
    .replace(/^\s*["'`]+|["'`]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= 70) return normalized;
  const shortened = normalized.slice(0, 70).replace(/\s+\S*$/, "").replace(/[,:;\-]+$/, "").trim();
  return shortened || normalized.slice(0, 70).trim();
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

function rankWeight(rank: number): number {
  return 1 / Math.log2(Math.max(1, rank) + 1);
}

function positionWeight(position: number): number {
  if (position <= 10) return 1;
  if (position <= 25) return 0.5;
  if (position <= 49) return 0.2;
  return 0;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function semanticFit(keyword: string, facts: string[]): number {
  if (facts.some((fact) => fact === keyword)) return 1;
  if (facts.some((fact) => keyword.split(" ").every((term) => fact.split(" ").includes(term)))) return 0.9;
  if (facts.some((fact) => fact.split(" ").includes(keyword) || keyword.split(" ").some((term) => fact.split(" ").includes(term)))) return 0.55;
  return 0;
}

function cohortScore(
  occurrences: { rank: number; position: number; cohort: PopulationCohort }[],
  samples: AdobePopulationSample[],
  cohort: PopulationCohort,
): number {
  const cohortSamples = samples.filter((sample) => (sample.sourceCohort ?? "relevance") === cohort);
  if (!cohortSamples.length) return 0;
  const maximum = cohortSamples.reduce((sum, sample) => sum + rankWeight(sample.sampleRank), 0) || 1;
  const observed = occurrences
    .filter((occurrence) => occurrence.cohort === cohort)
    .reduce((sum, occurrence) => sum + rankWeight(occurrence.rank) * positionWeight(occurrence.position), 0);
  return clamp(observed / maximum);
}

function freshnessSignal(
  occurrences: { freshnessScore?: number }[],
  samples: AdobePopulationSample[],
): number {
  const explicit = occurrences
    .map((occurrence) => occurrence.freshnessScore)
    .filter((value): value is number => value !== undefined)
    .map((value) => clamp(value / 100));
  if (explicit.length) return average(explicit);
  return cohortScore(
    occurrences as { rank: number; position: number; cohort: PopulationCohort }[],
    samples,
    "freshness",
  );
}

function weightedFeatureScore(
  imageSemanticFit: number,
  relevanceScore: number,
  visualNeighborScore: number,
  commercialScore: number,
  freshnessScore: number,
  featuredScore: number,
  featuredAvailable: boolean,
  availableCohorts: Set<PopulationCohort>,
): number {
  const weights: [number, number, boolean][] = featuredAvailable
    ? [
        [0.25, imageSemanticFit, true],
        [0.2, relevanceScore, true],
        [0.15, visualNeighborScore, availableCohorts.has("visual_neighbors")],
        [0.15, commercialScore, availableCohorts.has("downloads")],
        [0.1, freshnessScore, availableCohorts.has("freshness")],
        [0.15, featuredScore, true],
      ]
    : [
        [0.3, imageSemanticFit, true],
        [0.25, relevanceScore, true],
        [0.2, visualNeighborScore, availableCohorts.has("visual_neighbors")],
        [0.15, commercialScore, availableCohorts.has("downloads")],
        [0.1, freshnessScore, availableCohorts.has("freshness")],
      ];
  const totalWeight = weights.filter(([, , available]) => available).reduce((sum, [weight]) => sum + weight, 0) || 1;
  return weights.filter(([, , available]) => available).reduce((sum, [weight, score]) => sum + weight * score, 0) / totalWeight;
}

function isGenericSaturatedTerm(keyword: string): boolean {
  return ["design", "element", "graphic", "template", "texture", "abstract", "artwork"].includes(keyword);
}

function jaccardSimilarity(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]).size;
  if (!union) return 0;
  return [...leftSet].filter((term) => rightSet.has(term)).length / union;
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

function roundTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
