import { describe, expect, it } from "vitest";

import type { AdobePopulationResearch, AdobePopulationSample, InitialCandidate } from "../types";
import { aggregatePopulationKeywords, buildAdobeSearchUrl, isPopulationResearchStale, limitPopulationSamples, markUnavailableSample, rankPopulationSamples, selectPopulationTitle, validatePopulationQuery } from "./population";

function sample(rank: number, assetId: string, keywords: string[], metadataStatus: AdobePopulationSample["metadataStatus"] = "extracted"): AdobePopulationSample {
  return {
    sampleRank: rank,
    url: `https://stock.adobe.com/images/item/${assetId}`,
    assetId,
    searchTitle: undefined,
    keywords,
    dateConfidence: 0,
    metadataStatus,
  };
}

const candidate: InitialCandidate = {
  assetId: "asset-1",
  searchQuery: "capybara icon set",
  searchTerms: ["capybara", "icon", "set"],
  initialTitle: "Capybara Animal Icon Set in Black Silhouette Style",
  visualFacts: ["capybara", "animal icon", "black silhouette"],
  category: 1,
  confidence: 0.92,
};

function research(): AdobePopulationResearch {
  return {
    assetId: "asset-1",
    status: "ready",
    stale: false,
    query: "capybara icon set",
    locale: "uk",
    assetType: "vector",
    sort: "relevance",
    samples: [],
    keywordAggregation: [],
    selectedTitleSource: null,
    selectedKeywords: [],
    warnings: [],
  };
}

describe("population research helpers", () => {
  it("accepts an initial query with at most three English words", () => {
    expect(validatePopulationQuery("Haloween")).toBe(true);
    expect(validatePopulationQuery("capybara icon set")).toBe(true);
    expect(validatePopulationQuery("capybara icon set black")).toBe(false);
  });

  it("builds an encoded Adobe URL with the documented order parameter", () => {
    const url = buildAdobeSearchUrl("capybara icon set", "uk", "vector", "relevance");
    expect(url).toContain("/uk/search/images?");
    expect(url).toContain("k=capybara+icon+set");
    expect(url).toContain("order=relevance");
    expect(url).toContain("filters%5Bcontent_type%3Azip_vector%5D=1");
    expect(url).toContain("filters%5Bcontent_type%3Aphoto%5D=0");
    expect(url).toContain("search_type=filter-select");
    expect(url).toContain("get_facets=1");
    expect(url).not.toContain("nb_relevance");
  });

  it("keeps result rank, caps at twenty, and drops duplicate asset ids", () => {
    const input = Array.from({ length: 21 }, (_, index) => sample(index + 1, index === 5 ? "1" : String(index + 1), ["capybara"]));
    const limited = limitPopulationSamples([input[0], input[5], ...input.slice(1)], 20);
    expect(limited).toHaveLength(20);
    expect(limited[0]?.sampleRank).toBe(1);
    expect(limited.some((item) => item.sampleRank === 6)).toBe(false);
  });

  it("assigns newest relative creation rank and null dates", () => {
    const ranked = rankPopulationSamples([sample(1, "1", ["capybara"]), sample(2, "2", ["capybara"])], [
      { rank: 1, url: "https://stock.adobe.com/images/item/2", assetId: "2" },
      { rank: 2, url: "https://stock.adobe.com/images/item/1", assetId: "1" },
    ]);
    expect(ranked[1]?.creationRank).toBe(1);
    expect(ranked[1]?.freshnessScore).toBe(100);
    expect(ranked[0]?.estimatedYear).toBeNull();
  });

  it("aggregates frequency and position without recommending unsupported keywords", () => {
    const values = aggregatePopulationKeywords([sample(1, "1", ["capybara", "icon"]), sample(2, "2", ["CAPYBARA", "rabbit"])], candidate.visualFacts);
    const capybara = values.find((value) => value.normalizedKeyword === "capybara");
    const rabbit = values.find((value) => value.normalizedKeyword === "rabbit");
    expect(capybara?.frequency).toBe(2);
    expect(capybara?.averageKeywordPosition).toBe(1);
    expect(rabbit?.supportedByInput).toBe(false);
    expect(rabbit?.populationScore).toBe(0);
  });

  it("marks a changed filter stale and keeps title choices independent", () => {
    const state = research();
    expect(isPopulationResearchStale(state, "capybara photo", "uk", "photo", "relevance")).toBe(true);
    expect(selectPopulationTitle("initial", candidate, { ...state, recommendationTitleFromPopulation: "Population title" }, "Current title")).toBe(candidate.initialTitle);
    expect(selectPopulationTitle("population", candidate, { ...state, recommendationTitleFromPopulation: "Population title" }, "Current title")).toBe("Population title");
    expect(selectPopulationTitle("custom", candidate, state, "Current title")).toBe("Current title");
  });

  it("clears metadata when URL Context cannot read a URL", () => {
    const unavailable = markUnavailableSample(sample(1, "1", ["invented"]), "URL retrieval failed");
    expect(unavailable.metadataStatus).toBe("unavailable");
    expect(unavailable.keywords).toEqual([]);
    expect(unavailable.title).toBeUndefined();
  });
});
