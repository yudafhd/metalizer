import { describe, expect, it } from "vitest";

import type { AppSettings, DailyUsage } from "../types";
import { classifyGeminiError, isTokenBudgetExhausted, normalizeDailyUsage, remainingTokenBudget, todayKey, tokenBudgetPercent } from "./usage";

const usage: DailyUsage = {
  date: todayKey(),
  requests: 2,
  promptTokens: 700,
  outputTokens: 300,
  totalTokens: 1_000,
};

const settings: AppSettings = {
  model: "gemini-test",
  modelPreset: "custom",
  customModel: "gemini-test",
  batchSize: 1,
  concurrency: 1,
  metadataMode: "balanced",
  targetKeywords: 30,
  dailyTokenBudget: 2_000,
  additionalPrompt: "",
  contactSheetQuality: 85,
  maxSheetSize: 2048,
  background: "neutral",
  includeReleases: false,
  theme: "nebula",
};

describe("Gemini usage tracking", () => {
  it("calculates a local remaining budget and percentage", () => {
    expect(remainingTokenBudget(usage, settings.dailyTokenBudget)).toBe(1_000);
    expect(tokenBudgetPercent(usage, settings.dailyTokenBudget)).toBe(50);
    expect(isTokenBudgetExhausted(settings, usage)).toBe(false);
    expect(isTokenBudgetExhausted(settings, { ...usage, totalTokens: 2_000 })).toBe(true);
  });

  it("treats zero budget as unlimited local tracking", () => {
    expect(remainingTokenBudget(usage, 0)).toBeNull();
    expect(isTokenBudgetExhausted({ ...settings, dailyTokenBudget: 0 }, usage)).toBe(false);
  });

  it("classifies Gemini quota errors", () => {
    expect(classifyGeminiError("429 rate_limit_exceeded")).toBe("rate_limit_exceeded");
    expect(classifyGeminiError("quota_exceeded: daily quota")).toBe("quota_exceeded");
    expect(classifyGeminiError("network failure")).toBe("unknown");
  });

  it("keeps usage fields while normalizing stored error data", () => {
    const normalized = normalizeDailyUsage({
      ...usage,
      lastErrorKind: "quota_exceeded",
      lastErrorMessage: "Daily quota reached",
    });
    expect(normalized.totalTokens).toBe(1_000);
    expect(normalized.lastErrorKind).toBe("quota_exceeded");
  });
});
