import { convertFileSrc } from "@tauri-apps/api/core";

export interface VideoMetadataResult {
  width: number;
  height: number;
  duration: number;
  thumbnailUrl: string;
  storyboardDataUrl: string;
  framePreviews: { time: number; imageUrl: string }[];
}

export const MAX_VIDEO_FRAMES = 6;
const VIDEO_SEEK_TIMEOUT_MS = 30_000;
let extractionQueue: Promise<void> = Promise.resolve();

export function suggestedVideoFrameTimes(duration: number): number[] {
  const percentages = duration >= 30
    ? [0.07, 0.24, 0.41, 0.59, 0.76, 0.93]
    : [0.1, 0.35, 0.65, 0.9];
  return percentages.map((percentage) => percentage * duration);
}

export function isVideoMime(mimeType?: string): boolean {
  return Boolean(mimeType && mimeType.startsWith("video/"));
}

export function isVideoPath(path?: string): boolean {
  if (!path) return false;
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "mp4" || ext === "mov" || ext === "webm" || ext === "m4v";
}

export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function seekToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let waitingForFrame = false;
    let frameCallbackId: number | undefined;
    let frameFallback: number | undefined;
    const timeout = window.setTimeout(() => finish(new Error(`Gagal mengambil frame pada detik ${time.toFixed(1)}. Video beresolusi tinggi mungkin membutuhkan codec yang didukung sistem.`)), VIDEO_SEEK_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      if (frameFallback !== undefined) window.clearTimeout(frameFallback);
      if (frameCallbackId !== undefined) video.cancelVideoFrameCallback(frameCallbackId);
      video.removeEventListener("seeked", onReady);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onReady = () => {
      if (!waitingForFrame && !video.seeking && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Math.abs(video.currentTime - time) < 0.25) {
        waitingForFrame = true;
        if (typeof video.requestVideoFrameCallback === "function") {
          frameCallbackId = video.requestVideoFrameCallback(() => finish());
          frameFallback = window.setTimeout(() => finish(), 1_000);
        } else {
          finish();
        }
      }
    };
    const onError = () => finish(new Error("Gagal mendekode frame video."));

    video.addEventListener("seeked", onReady);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
    try {
      video.currentTime = time;
      onReady();
    } catch {
      finish(new Error(`Tidak dapat menuju detik ${time.toFixed(1)} pada video.`));
    }
  });
}

export function captureVideoFrame(video: HTMLVideoElement, width = 320, height = 180): string {
  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error("Frame video belum siap. Tunggu sebentar lalu coba lagi.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas untuk frame video tidak tersedia.");
  drawContainedFrame(context, video, width, height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function drawContainedFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
): void {
  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, width, height);
  const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
  const drawnWidth = video.videoWidth * scale;
  const drawnHeight = video.videoHeight * scale;
  context.drawImage(video, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}

function createStoryboardGrid(
  frames: { canvas: HTMLCanvasElement; timestamp: string }[],
  targetCellWidth = 640,
  targetCellHeight = 360,
): HTMLCanvasElement {
  const gap = 4;
  const cols = frames.length > 4 ? 3 : frames.length > 1 ? 2 : 1;
  const rows = Math.ceil(frames.length / cols);
  const totalWidth = targetCellWidth * cols + gap * (cols + 1);
  const totalHeight = targetCellHeight * rows + gap * (rows + 1);

  const collage = document.createElement("canvas");
  collage.width = totalWidth;
  collage.height = totalHeight;
  const ctx = collage.getContext("2d");
  if (!ctx) throw new Error("Canvas untuk storyboard video tidak tersedia.");

  // Background
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  frames.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = gap + col * (targetCellWidth + gap);
    const y = gap + row * (targetCellHeight + gap);

    // Draw video frame
    ctx.drawImage(frame.canvas, x, y, targetCellWidth, targetCellHeight);

    // Draw timestamp badge
    const badgeText = frame.timestamp;
    ctx.font = "bold 18px ui-sans-serif, system-ui, sans-serif";
    const textWidth = ctx.measureText(badgeText).width;
    const badgePaddingX = 10;
    const badgeHeight = 28;
    const badgeWidth = textWidth + badgePaddingX * 2;
    const badgeX = x + targetCellWidth - badgeWidth - 12;
    const badgeY = y + targetCellHeight - badgeHeight - 12;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, badgeX + badgePaddingX, badgeY + badgeHeight / 2);
  });

  return collage;
}

export function extractVideoMetadataAndStoryboard(
  filePath: string,
  frameTimes?: number[],
  coverTime?: number,
): Promise<VideoMetadataResult> {
  const result = extractionQueue.then(() => extractVideoMetadataAndStoryboardNow(filePath, frameTimes, coverTime));
  extractionQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function extractVideoMetadataAndStoryboardNow(
  filePath: string,
  frameTimes?: number[],
  coverTime?: number,
): Promise<VideoMetadataResult> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => finish(new Error("Gagal membaca metadata video: waktu tunggu habis.")), 30_000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
      };
      const finish = (error?: Error) => {
        cleanup();
        if (error) reject(error);
        else resolve();
      };
      const onLoaded = () => finish();
      const onError = () => finish(new Error("Format atau codec video tidak didukung oleh pemutar sistem."));
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
      video.src = convertFileSrc(filePath);
    });

    const width = video.videoWidth;
    const height = video.videoHeight;
    const duration = video.duration;
    if (width <= 0 || height <= 0 || !Number.isFinite(duration) || duration <= 0) {
      throw new Error("Dimensi atau durasi video tidak valid.");
    }

    const times = frameTimes?.length
      ? frameTimes.slice(0, MAX_VIDEO_FRAMES).map((time) => Math.max(0, Math.min(time, duration - 0.05)))
      : suggestedVideoFrameTimes(duration);
    const cellWidth = 640;
    const cellHeight = 360;
    const extractedFrames: { canvas: HTMLCanvasElement; timestamp: string }[] = [];
    const framePreviews: VideoMetadataResult["framePreviews"] = [];

    for (const time of times) {
      await seekToTime(video, time);
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = cellWidth;
      frameCanvas.height = cellHeight;
      const frameCtx = frameCanvas.getContext("2d");
      if (!frameCtx) throw new Error("Canvas untuk frame video tidak tersedia.");
      drawContainedFrame(frameCtx, video, cellWidth, cellHeight);
      extractedFrames.push({ canvas: frameCanvas, timestamp: formatDuration(video.currentTime) });
      const previewCanvas = document.createElement("canvas");
      previewCanvas.width = 320;
      previewCanvas.height = 180;
      const previewCtx = previewCanvas.getContext("2d");
      if (!previewCtx) throw new Error("Canvas untuk pratinjau frame tidak tersedia.");
      previewCtx.drawImage(frameCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
      framePreviews.push({ time, imageUrl: previewCanvas.toDataURL("image/jpeg", 0.8) });
    }

    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 320;
    thumbCanvas.height = 180;
    const thumbCtx = thumbCanvas.getContext("2d");
    if (!thumbCtx) throw new Error("Canvas untuk thumbnail video tidak tersedia.");
    const coverIndex = coverTime === undefined ? 0 : times.findIndex((time) => Math.abs(time - coverTime) < 0.5);
    thumbCtx.drawImage(extractedFrames[Math.max(0, coverIndex)].canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

    const storyboardCanvas = createStoryboardGrid(extractedFrames, cellWidth, cellHeight);
    return {
      width,
      height,
      duration,
      thumbnailUrl: thumbCanvas.toDataURL("image/jpeg", 0.85),
      storyboardDataUrl: storyboardCanvas.toDataURL("image/jpeg", 0.85),
      framePreviews,
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}
