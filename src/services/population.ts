import type {
  AdobePopulationResearch,
  AdobePopulationSearchRequest,
  AdobePopulationSearchResponse,
  AdobePopulationSearchResult,
  AdobePopulationSample,
  InitialCandidate,
  InitialCandidateRequest,
  PopulationAnalysisRequest,
  PopulationAnalysisResponse,
  PopulationKeyword,
} from "../types";
import { invokeCommand } from "./tauri";

export function analyzeInitialCandidate(request: InitialCandidateRequest): Promise<InitialCandidate> {
  return invokeCommand("analyze_initial_candidate", { request });
}

export function searchAdobePopulation(request: AdobePopulationSearchRequest): Promise<AdobePopulationSearchResponse> {
  return invokeCommand("search_adobe_population", { request });
}

export function analyzeAdobePopulation(request: PopulationAnalysisRequest): Promise<PopulationAnalysisResponse> {
  return invokeCommand("analyze_adobe_population", { request });
}

export function cancelPopulationAnalysis(assetId: string): Promise<void> {
  return invokeCommand("cancel_population_analysis", { assetId });
}

export function calculatePopulationRanking(samples: AdobePopulationSample[], creationResults: AdobePopulationSearchResult[]): Promise<AdobePopulationSample[]> {
  return invokeCommand("calculate_population_ranking", { request: { samples, creationResults } });
}

export function aggregatePopulationKeywords(samples: AdobePopulationSample[], visualFacts: string[]): Promise<PopulationKeyword[]> {
  return invokeCommand("aggregate_population_keywords", { request: { samples, visualFacts } });
}

export function populationResearchForAsset(assetId: string, candidate: InitialCandidate): AdobePopulationResearch {
  return {
    assetId,
    status: "idle",
    stale: false,
    query: candidate.searchQuery,
    locale: "id",
    assetType: "vector",
    sort: "relevance",
    samples: [],
    keywordAggregation: [],
    selectedTitleSource: null,
    selectedKeywords: [],
    warnings: [],
  };
}
