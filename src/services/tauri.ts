import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import type {
  ApiStatus,
  AssetDescriptor,
  ContactSheetRequest,
  ContactSheetResult,
  CsvExportRequest,
  CsvExportResult,
  GenerateMetadataRequest,
  MetadataGenerationResult,
  ValidationResult,
} from "../types";

export const isTauri = "__TAURI_INTERNALS__" in window;

export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) throw new Error("This action is available in the desktop application");
  return invoke<T>(command, args);
}

export async function chooseImages(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function chooseFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
}

export async function chooseCsvOutput(defaultPath = "adobe-stock-metadata.csv"): Promise<string | null> {
  const selected = await save({
    defaultPath,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  return selected ?? null;
}

export function inspectAssets(paths: string[]): Promise<AssetDescriptor[]> {
  return invokeCommand<AssetDescriptor[]>("inspect_assets", { paths });
}

export function scanFolder(path: string): Promise<{ paths: string[]; rejectedCount: number }> {
  return invokeCommand("scan_folder", { path });
}

export function createContactSheet(request: ContactSheetRequest): Promise<ContactSheetResult> {
  return invokeCommand("create_contact_sheet", { request });
}

export function generateMetadata(request: GenerateMetadataRequest): Promise<MetadataGenerationResult> {
  return invokeCommand("generate_metadata", { request });
}

export function cancelGeneration(batchId: string): Promise<void> {
  return invokeCommand("cancel_generation", { batchId });
}

export function setApiKey(apiKey: string): Promise<void> {
  return invokeCommand("set_api_key", { apiKey });
}

export function deleteApiKey(): Promise<void> {
  return invokeCommand("delete_api_key");
}

export function testApiKey(apiKey?: string): Promise<ApiStatus> {
  return invokeCommand("test_api_key", { apiKey });
}

export function validateAssetMetadata(args: {
  filename: string;
  title: string;
  keywords: string[];
  category: number;
  maximumKeywords: number;
}): Promise<ValidationResult> {
  return invokeCommand("validate_asset_metadata", args);
}

export function exportCsvFile(request: CsvExportRequest): Promise<CsvExportResult> {
  return invokeCommand("export_csv_file", { request });
}

export function cleanupTempFile(path: string): Promise<void> {
  return invokeCommand("cleanup_temp_file", { path });
}
