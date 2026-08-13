import { cancelGeneration, cleanupTempFile, createContactSheet, generateMetadata } from "./tauri";
import { emptyMetadata, normalizeKeywords, qualityScore, validateMetadata } from "../utils/metadata";
import { chunkItems } from "../utils/batching";
import { useAppStore } from "../stores/appStore";
import type { AppSettings, AssetStatus, BatchJob, GeneratedMetadata, MetadataMode, StockAsset, StockMetadata } from "../types";

const activeBatchIds = new Set<string>();
let cancelRequested = false;

export async function runGeneration(options: { onlyFailed?: boolean; assetIds?: string[]; scope?: "full" | "title" | "keywords" } = {}): Promise<void> {
  const store = useAppStore.getState();
  if (store.isGenerating) return;
  if (!store.apiKeyConfigured || !store.apiKeyVerified) {
    store.addNotice("warning", "Gemini API key is required. Open Settings to configure it.");
    return;
  }
  if (store.settings.modelPreset === "custom" && !store.settings.customModel.trim()) {
    store.addNotice("error", "Custom model ID is empty. Set a valid Gemini model in Settings.");
    return;
  }
  const candidates = store.assets.filter((asset) => {
    if (options.assetIds && !options.assetIds.includes(asset.id)) return false;
    return options.onlyFailed ? asset.status === "failed" || Boolean(options.assetIds?.includes(asset.id)) : asset.status !== "completed";
  });
  if (!candidates.length) {
    store.addNotice("info", "There are no assets waiting for metadata generation.");
    return;
  }
  cancelRequested = false;
  const jobs = chunkItems(candidates, store.settings.batchSize).map((assets, index) => ({
    id: `batch-${Date.now()}-${index + 1}`,
    assetIds: assets.map((asset) => asset.id),
    status: "queued" as AssetStatus,
    attempt: 0,
  }));
  store.setJobs(jobs);
  store.setGenerating(true);
  store.setProgress({
    total: candidates.length,
    completed: 0,
    processing: 0,
    queuedBatches: jobs.length,
    cancelled: false,
  });
  candidates.forEach((asset) => store.setAssetStatus(asset.id, "queued"));

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (!cancelRequested) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      if (!job) return;
    await processJob(job, store.settings, options.scope ?? "full");
    }
  };
  const workers = Array.from({ length: Math.min(store.settings.concurrency, jobs.length) }, () => worker());
  await Promise.all(workers);
  store.setGenerating(false);
  store.patchProgress({
    processing: 0,
    queuedBatches: store.jobs.filter((job) => job.status === "queued" || job.status === "preparing" || job.status === "processing").length,
    cancelled: cancelRequested,
  });
  if (cancelRequested) store.addNotice("info", "Generation cancelled. Completed metadata was kept.");
}

export async function cancelActiveGeneration(): Promise<void> {
  cancelRequested = true;
  await Promise.allSettled([...activeBatchIds].map((batchId) => cancelGeneration(batchId)));
}

async function processJob(job: BatchJob, settings: AppSettings, scope: "full" | "title" | "keywords"): Promise<void> {
  const store = useAppStore.getState();
  store.updateJob(job.id, { status: "preparing", attempt: 1 });
  store.patchProgress({ currentBatch: job.id, queuedBatches: Math.max(0, store.progress.queuedBatches - 1) });
  let remainingAssets = job.assetIds.map((id) => useAppStore.getState().assets.find((asset) => asset.id === id)).filter((asset): asset is StockAsset => Boolean(asset));
  let partialAttempt = 0;
  let lastError: string | undefined;

  while (remainingAssets.length && partialAttempt < 3 && !cancelRequested) {
    partialAttempt += 1;
    const requestBatchId = `${job.id}-${partialAttempt}`;
    activeBatchIds.add(requestBatchId);
    remainingAssets.forEach((asset) => store.setAssetStatus(asset.id, partialAttempt === 1 ? "preparing" : "processing"));
    store.updateJob(job.id, { status: "processing", attempt: partialAttempt });
    store.patchProgress({ processing: countProcessingAssets(), currentBatch: requestBatchId });
    const panelAssets = remainingAssets.map((asset, index) => ({
      panelId: String(index + 1).padStart(2, "0"),
      path: asset.path,
      filename: asset.filename,
    }));
    let contactSheetPath: string | undefined;
    try {
      const sheet = await createContactSheet({
        batchId: requestBatchId,
        assets: panelAssets,
        maxSheetSize: settings.maxSheetSize,
        quality: settings.contactSheetQuality,
        background: settings.background,
      });
      contactSheetPath = sheet.path;
      const response = await generateMetadata({
        batchId: requestBatchId,
        contactSheetPath: sheet.path,
        expectedIds: panelAssets.map((asset) => asset.panelId),
        mapping: panelAssets.map((asset) => ({ id: asset.panelId, filename: asset.filename })),
        model: settings.modelPreset === "custom" ? settings.customModel : settings.model,
        mode: settings.metadataMode,
        targetKeywords: settings.targetKeywords,
        generationScope: scope,
      });
      const responseById = new Map(response.assets.map((asset) => [asset.id, asset]));
      for (const panel of panelAssets) {
        const generated = responseById.get(panel.panelId);
        const sourceAsset = remainingAssets.find((asset) => asset.id === findAssetId(panelAssets, panel.panelId, remainingAssets));
        if (!generated || !sourceAsset) continue;
        applyGeneratedMetadata(sourceAsset, generated, settings.metadataMode, scope);
      }
      const missing = new Set(response.missingIds);
      const completedIds = panelAssets.filter((panel) => !missing.has(panel.panelId)).map((panel) => findAssetId(panelAssets, panel.panelId, remainingAssets));
      completedIds.forEach((id) => {
        if (id) {
          store.setAssetStatus(id, "completed");
          store.patchProgress({ completed: useAppStore.getState().progress.completed + 1 });
        }
      });
      remainingAssets = remainingAssets.filter((asset) => {
        const panel = panelAssets.find((candidate) => candidate.path === asset.path);
        return panel ? missing.has(panel.panelId) : true;
      });
      if (response.warnings.length) store.addNotice("warning", `${job.id}: ${response.warnings.join("; ")}`);
      if (!remainingAssets.length) {
        store.updateJob(job.id, { status: "completed", attempt: response.attempts });
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      break;
    } finally {
      activeBatchIds.delete(requestBatchId);
      if (contactSheetPath) await cleanupTempFile(contactSheetPath).catch(() => undefined);
    }
  }

  if (cancelRequested) {
    remainingAssets.forEach((asset) => store.setAssetStatus(asset.id, "queued"));
    store.updateJob(job.id, { status: "queued", error: "Cancelled" });
  } else if (remainingAssets.length) {
    const message = lastError ?? "Gemini did not return metadata for every panel after three partial retries.";
    remainingAssets.forEach((asset) => store.setAssetStatus(asset.id, "failed", message));
    store.updateJob(job.id, { status: "failed", error: message });
    store.addNotice("error", `${job.id} failed: ${message}`);
  }
}

function applyGeneratedMetadata(asset: StockAsset, generated: GeneratedMetadata, mode: MetadataMode, scope: "full" | "title" | "keywords"): void {
  const store = useAppStore.getState();
  const previous = asset.metadata ?? emptyMetadata(asset, mode);
  const keywords = normalizeKeywords(generated.keywords, asset.filename, 49);
  const draft: StockMetadata = {
    ...previous,
    assetId: asset.id,
    title: scope === "keywords" ? previous.title : generated.title.replace(/[\r\n]+/g, " ").trim(),
    keywords: scope === "title" ? previous.keywords : keywords,
    category: scope === "title" || scope === "keywords" ? previous.category : generated.category,
    metadataMode: mode,
    aiGenerated: true,
  };
  const validation = validateMetadata(asset.filename, draft, 49);
  store.patchAsset(asset.id, {
    previousMetadata: asset.metadata,
    metadata: {
      ...draft,
      keywords: validation.normalizedKeywords,
      warnings: validation.warnings,
      qualityScore: qualityScore({ ...draft, keywords: validation.normalizedKeywords }, validation),
    },
    error: undefined,
  });
  if (validation.warnings.length) {
    store.addNotice("warning", `${asset.filename}: ${validation.warnings[0]?.message ?? "Review metadata"}`);
  }
}

function findAssetId(panelAssets: { panelId: string; path: string }[], panelId: string, assets: StockAsset[]): string {
  const panel = panelAssets.find((candidate) => candidate.panelId === panelId);
  return assets.find((asset) => asset.path === panel?.path)?.id ?? "";
}

function countProcessingAssets(): number {
  return useAppStore.getState().assets.filter((asset) => asset.status === "preparing" || asset.status === "processing").length;
}
