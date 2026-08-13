import { LazyStore } from "@tauri-apps/plugin-store";

export const preferencesStore = new LazyStore("preferences.json", { autoSave: true });
