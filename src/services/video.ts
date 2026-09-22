import { convertFileSrc } from "@tauri-apps/api/core";

export interface VideoMetadataResult {
  width: number;
  height: number;
  duration: number;
  thumbnailUrl: string;
  storyboardDataUrl: string;
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

function seekToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const onSeeked = () => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = Math.max(0, Math.min(time, video.duration || time));

    // Fallback timeout in case seeked doesn't fire
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        video.removeEventListener("seeked", onSeeked);
        resolve();
      }
    }, 1500);
  });
}

function createStoryboardGrid(
  frames: { canvas: HTMLCanvasElement; timestamp: string }[],
  targetCellWidth = 640,
  targetCellHeight = 360,
): HTMLCanvasElement {
  const gap = 4;
  const cols = 2;
  const rows = 2;
  const totalWidth = targetCellWidth * cols + gap * (cols + 1);
  const totalHeight = targetCellHeight * rows + gap * (rows + 1);

  const collage = document.createElement("canvas");
  collage.width = totalWidth;
  collage.height = totalHeight;
  const ctx = collage.getContext("2d");
  if (!ctx) return collage;

  // Background
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  frames.slice(0, 4).forEach((frame, index) => {
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

export async function extractVideoMetadataAndStoryboard(
  filePath: string,
  sampleCount = 4,
): Promise<VideoMetadataResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const assetUrl = convertFileSrc(filePath);
    video.src = assetUrl;

    let cleanupDone = false;
    const cleanup = () => {
      if (cleanupDone) return;
      cleanupDone = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Gagal membaca video: waktu tunggu habis (timeout)."));
    }, 15000);

    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Format atau codec video tidak didukung oleh pemutar sistem."));
    };

    video.onloadedmetadata = async () => {
      try {
        const width = video.videoWidth || 1920;
        const height = video.videoHeight || 1080;
        const duration = Math.max(0.1, video.duration || 1);

        // Relative sampling points (e.g. 10%, 35%, 65%, 90%)
        const percentages =
          sampleCount === 4
            ? [0.1, 0.35, 0.65, 0.9]
            : Array.from({ length: sampleCount }, (_, i) => (i + 1) / (sampleCount + 1));

        const sampleTimes = percentages.map((pct) => pct * duration);
        const cellWidth = 640;
        const cellHeight = Math.max(200, Math.round((cellWidth * height) / width));

        const extractedFrames: { canvas: HTMLCanvasElement; timestamp: string }[] = [];

        for (const time of sampleTimes) {
          await seekToTime(video, time);
          const frameCanvas = document.createElement("canvas");
          frameCanvas.width = cellWidth;
          frameCanvas.height = cellHeight;
          const frameCtx = frameCanvas.getContext("2d");
          if (frameCtx) {
            frameCtx.drawImage(video, 0, 0, cellWidth, cellHeight);
            extractedFrames.push({
              canvas: frameCanvas,
              timestamp: formatDuration(time),
            });
          }
        }

        clearTimeout(timeout);
        cleanup();

        if (!extractedFrames.length) {
          throw new Error("Gagal mengekstrak frame dari video.");
        }

        // Thumbnail: scale down the first frame
        const thumbCanvas = document.createElement("canvas");
        thumbCanvas.width = 320;
        thumbCanvas.height = Math.max(100, Math.round((320 * height) / width));
        const thumbCtx = thumbCanvas.getContext("2d");
        if (thumbCtx) {
          thumbCtx.drawImage(extractedFrames[0].canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        }
        const thumbnailUrl = thumbCanvas.toDataURL("image/jpeg", 0.85);

        // Storyboard 2x2 collage
        const storyboardCanvas = createStoryboardGrid(extractedFrames, cellWidth, cellHeight);
        const storyboardDataUrl = storyboardCanvas.toDataURL("image/jpeg", 0.85);

        resolve({
          width,
          height,
          duration,
          thumbnailUrl,
          storyboardDataUrl,
        });
      } catch (error) {
        clearTimeout(timeout);
        cleanup();
        reject(error);
      }
    };
  });
}
