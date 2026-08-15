import { preferencesStore } from "./store";

import { GEMINI_MODELS, LEGACY_GEMINI_MODELS } from "../constants/models";
import { APP_THEMES } from "../constants/themes";
import type { AppSettings } from "../types";

const settingsKey = "app-settings";

export async function readSettings(defaults: AppSettings): Promise<AppSettings> {
  if (!("__TAURI_INTERNALS__" in window)) return defaults;
  const stored = await preferencesStore.get<AppSettings>(settingsKey);
  if (!stored) return defaults;
  const targetKeywords = Number.isFinite(stored.targetKeywords) ? Math.max(20, Math.min(35, stored.targetKeywords)) : defaults.targetKeywords;
  const additionalPrompt = typeof stored.additionalPrompt === "string" ? stored.additionalPrompt : defaults.additionalPrompt;
  const theme = APP_THEMES.some((item) => item.value === stored.theme) ? stored.theme : defaults.theme;
  if (LEGACY_GEMINI_MODELS.has(stored.model)) {
    return {
      ...stored,
      targetKeywords,
      additionalPrompt,
      theme,
      model: stored.modelPreset === "fast" ? GEMINI_MODELS.fast : stored.modelPreset === "balanced" ? GEMINI_MODELS.balanced : stored.model,
    };
  }
  return { ...stored, targetKeywords, additionalPrompt, theme };
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await preferencesStore.set(settingsKey, settings);
  await preferencesStore.save();
}
