import { preferencesStore } from "./store";
import type { AdobePopulationResearch, InitialCandidate } from "../types";

const initialCandidatesKey = "population-initial-candidates";
const researchKey = "population-research";

export interface PopulationPersistedState {
  initialCandidates: Record<string, InitialCandidate>;
  research: Record<string, AdobePopulationResearch>;
}

export async function loadPopulationState(): Promise<PopulationPersistedState> {
  if (!("__TAURI_INTERNALS__" in window)) return { initialCandidates: {}, research: {} };
  const [initialCandidates, research] = await Promise.all([
    preferencesStore.get<Record<string, InitialCandidate>>(initialCandidatesKey),
    preferencesStore.get<Record<string, AdobePopulationResearch>>(researchKey),
  ]);
  return { initialCandidates: initialCandidates ?? {}, research: research ?? {} };
}

export async function saveInitialCandidate(candidate: InitialCandidate): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const current = (await preferencesStore.get<Record<string, InitialCandidate>>(initialCandidatesKey)) ?? {};
  await preferencesStore.set(initialCandidatesKey, { ...current, [candidate.assetId]: candidate });
  await preferencesStore.save();
}

export async function savePopulationResearch(research: AdobePopulationResearch): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const current = (await preferencesStore.get<Record<string, AdobePopulationResearch>>(researchKey)) ?? {};
  await preferencesStore.set(researchKey, { ...current, [research.assetId]: research });
  await preferencesStore.save();
}
