export const GEMINI_MODELS = {
  balanced: "gemini-3.5-flash-lite",
  fast: "gemini-3.1-flash-lite",
  population: "gemini-3.6-flash",
  populationPro: "gemini-3.1-pro-preview",
} as const;

export const LEGACY_GEMINI_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-flash-preview-05-20",
]);
