import { preferencesStore } from "./store";

import type { AppSettings } from "../types";

const settingsKey = "app-settings";

export async function readSettings(defaults: AppSettings): Promise<AppSettings> {
  if (!("__TAURI_INTERNALS__" in window)) return defaults;
  return (await preferencesStore.get<AppSettings>(settingsKey)) ?? defaults;
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await preferencesStore.set(settingsKey, settings);
  await preferencesStore.save();
}
