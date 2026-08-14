import { preferencesStore } from "./store";

import type { DailyUsage, GeminiUsageMetadata } from "../types";

const usageKey = "gemini-daily-usage";

export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyDailyUsage(date = todayKey()): DailyUsage {
  return {
    date,
    requests: 0,
    promptTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}

export function normalizeDailyUsage(value: Partial<DailyUsage> | null | undefined): DailyUsage {
  if (!value || value.date !== todayKey()) return emptyDailyUsage();
  return {
    date: value.date,
    requests: Math.max(0, Number(value.requests) || 0),
    promptTokens: Math.max(0, Number(value.promptTokens) || 0),
    outputTokens: Math.max(0, Number(value.outputTokens) || 0),
    totalTokens: Math.max(0, Number(value.totalTokens) || 0),
  };
}

export async function readDailyUsage(): Promise<DailyUsage> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return emptyDailyUsage();
  const stored = await preferencesStore.get<DailyUsage>(usageKey);
  return normalizeDailyUsage(stored);
}

export async function writeDailyUsage(usage: DailyUsage): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  await preferencesStore.set(usageKey, normalizeDailyUsage(usage));
  await preferencesStore.save();
}

export function usageToDailyDelta(usage: GeminiUsageMetadata): Omit<DailyUsage, "date"> {
  return {
    requests: 1,
    promptTokens: Math.max(0, Number(usage.promptTokenCount) || 0),
    outputTokens: Math.max(0, Number(usage.candidatesTokenCount) || 0),
    totalTokens: Math.max(0, Number(usage.totalTokenCount) || 0),
  };
}

export function formatTokenCount(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
}
