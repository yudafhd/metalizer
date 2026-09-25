import { convertFileSrc } from "@tauri-apps/api/core";
import { Check, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useRef, useState } from "react";

import { captureVideoFrame, formatDuration, MAX_VIDEO_FRAMES, seekToTime } from "../../services/video";
import type { StockAsset } from "../../types";

interface SelectedFrame {
  time: number;
  imageUrl: string;
}

const FRAME_INTERVALS = [20, 30, 40] as const;

function intervalFrameTimes(duration: number, intervalPercent: number): number[] {
  const count = Math.min(MAX_VIDEO_FRAMES, Math.floor(100 / intervalPercent));
  const times = Array.from({ length: count }, (_, index) =>
    Math.min(duration * intervalPercent * (index + 1) / 100, Math.max(0, duration - 0.05)),
  );
  return times.filter((time, index) => index === 0 || time - times[index - 1] >= 0.05);
}

interface Props {
  asset: StockAsset;
  onClose: () => void;
  onSave: (times: number[], coverTime: number) => Promise<void>;
}

export function VideoFrameModal({ asset, onClose, onSave }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(asset.duration ?? 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [frames, setFrames] = useState<SelectedFrame[]>(() => asset.videoFramePreviews?.slice(0, MAX_VIDEO_FRAMES) ?? []);
  const [coverTime, setCoverTime] = useState<number | undefined>(() => asset.videoCoverTime ?? asset.videoFramePreviews?.[0]?.time);
  const [busy, setBusy] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<number>();
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; interval: number } | null>(null);
  const batchSelectingRef = useRef(false);
  const [error, setError] = useState<string>();

  const handleLoaded = async () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    const savedTimes = asset.videoFrameTimes ?? [];
    if (!savedTimes.length || asset.videoFramePreviews?.length) return;
    setLoadingFrames(true);
    try {
      const restored: SelectedFrame[] = [];
      for (const time of savedTimes) {
        await seekToTime(video, Math.min(time, video.duration - 0.05));
        restored.push({ time, imageUrl: captureVideoFrame(video) });
      }
      setFrames(restored);
      setCoverTime(asset.videoCoverTime ?? savedTimes[0]);
      setCurrentTime(video.currentTime);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingFrames(false);
    }
  };

  const addFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;
    if (frames.some((frame) => Math.abs(frame.time - time) < 0.5)) {
      setError("Titik ini sudah dipilih. Geser waktu video sedikit lebih jauh.");
      return;
    }
    try {
      const next = [...frames, { time, imageUrl: captureVideoFrame(video) }].sort((a, b) => a.time - b.time);
      setFrames(next);
      setCoverTime((current) => current ?? next[0].time);
      setSelectedInterval(undefined);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const applyInterval = async (intervalPercent: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(duration) || duration <= 0 || batchSelectingRef.current) return;
    const times = intervalFrameTimes(duration, intervalPercent);
    batchSelectingRef.current = true;
    setError(undefined);
    try {
      video.pause();
      const selected: SelectedFrame[] = [];
      for (const [index, time] of times.entries()) {
        setBatchProgress({ current: index + 1, total: times.length, interval: intervalPercent });
        await seekToTime(video, time);
        selected.push({ time: video.currentTime, imageUrl: captureVideoFrame(video) });
      }
      setFrames(selected);
      setCoverTime((current) => selected.find((frame) => Math.abs(frame.time - (current ?? -1)) < 0.5)?.time ?? selected[0].time);
      setCurrentTime(video.currentTime);
      setSelectedInterval(intervalPercent);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      batchSelectingRef.current = false;
      setBatchProgress(null);
    }
  };

  const save = async () => {
    if (!frames.length || coverTime === undefined || batchSelectingRef.current) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSave(frames.map((frame) => frame.time), coverTime);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="video-frame-title">
      <div className="flex max-h-[92vh] w-full max-w-[800px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-modal">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="video-frame-title" className="text-[16px] font-extrabold text-ink">Pilih titik gambar video</h2>
            <p className="mt-1 truncate text-[11px] text-ink-muted" title={asset.filename}>{asset.filename}</p>
          </div>
          <button type="button" className="app-button app-button-quiet h-8 w-8 px-0" onClick={onClose} disabled={busy} aria-label="Tutup pemilihan gambar"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto p-5">
          <p className="mb-3 text-[12px] leading-5 text-ink-secondary">Pilih jarak antar titik untuk mengambil gambar otomatis, atau geser video untuk memilih manual. Klik gambar terpilih untuk menjadikannya thumbnail utama.</p>
          <div className="relative flex h-[300px] items-center justify-center overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              src={convertFileSrc(asset.path)}
              crossOrigin="anonymous"
              controls
              preload="metadata"
              playsInline
              poster={asset.previewUrl}
              className="h-full max-w-full object-contain"
              onLoadedMetadata={() => void handleLoaded()}
              onLoadedData={() => setVideoLoading(false)}
              onWaiting={() => setVideoLoading(true)}
              onCanPlay={() => setVideoLoading(false)}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onSeeking={() => { setSeeking(true); setVideoLoading(true); }}
              onSeeked={() => { setSeeking(false); setVideoLoading(false); }}
              onError={() => { setVideoLoading(false); setError("Video tidak dapat dibuka. Periksa format, codec, atau akses file."); }}
            />
            {videoLoading ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white" role="status">
                <LoaderCircle size={24} className="animate-spin" />
                <span className="text-[11px] font-semibold">Memuat video...</span>
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="w-11 text-[11px] font-bold tabular-nums text-ink">{formatDuration(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, duration - 0.05)}
              step={0.1}
              value={Math.min(currentTime, Math.max(0, duration - 0.05))}
              disabled={!duration || loadingFrames || busy || batchProgress !== null}
              onChange={(event) => {
                const time = Number(event.target.value);
                if (videoRef.current) videoRef.current.currentTime = time;
                setCurrentTime(time);
              }}
              className="min-w-0 flex-1 accent-accent-500"
              aria-label="Pilih titik waktu video"
            />
            <span className="w-11 text-right text-[11px] font-bold tabular-nums text-ink-muted">{formatDuration(duration)}</span>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-extrabold text-ink">Jarak antar titik gambar</h3>
              <span className="text-[10px] text-ink-muted">Maksimal {MAX_VIDEO_FRAMES} titik</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {FRAME_INTERVALS.map((interval) => (
                <button
                  key={interval}
                  type="button"
                  className={`app-button h-11 min-w-0 ${selectedInterval === interval ? "app-button-primary" : ""}`}
                  onClick={() => void applyInterval(interval)}
                  disabled={!duration || videoLoading || loadingFrames || busy || seeking || batchProgress !== null}
                  aria-label={`Ambil gambar otomatis setiap ${interval} persen durasi video`}
                  aria-pressed={selectedInterval === interval}
                >
                  {batchProgress?.interval === interval ? <LoaderCircle size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  {interval}%
                  <span className="text-[10px] opacity-70">{Math.min(MAX_VIDEO_FRAMES, Math.floor(100 / interval))} gambar</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-ink-muted">Video 10 detik + 20%: ambil di detik 2, 4, 6, 8, dan mendekati 10. Pilihan ini mengganti gambar terpilih.</p>
            {batchProgress ? <p className="mt-1 text-[10px] font-semibold text-accent-500" role="status">Mengambil gambar {batchProgress.current}/{batchProgress.total}...</p> : null}
          </div>
          <button type="button" className="app-button app-button-primary mt-3 w-full" onClick={addFrame} disabled={!duration || loadingFrames || busy || seeking || batchProgress !== null || frames.length >= MAX_VIDEO_FRAMES}>
            {loadingFrames ? <LoaderCircle size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            Ambil gambar di {formatDuration(currentTime)}
          </button>

          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-[12px] font-extrabold text-ink">Gambar terpilih ({frames.length}/{MAX_VIDEO_FRAMES})</h3>
            <span className="text-[10px] text-ink-muted">Klik gambar untuk menjadikannya gambar utama</span>
          </div>
          {frames.length ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {frames.map((frame) => (
                <div key={frame.time} className={`overflow-hidden rounded-xl border ${coverTime === frame.time ? "border-accent-500" : "border-line"}`}>
                  <button type="button" className="relative block w-full bg-surface-sunken" onClick={() => setCoverTime(frame.time)} aria-label={`Jadikan gambar pada ${formatDuration(frame.time)} gambar utama`} aria-pressed={coverTime === frame.time}>
                    <img src={frame.imageUrl} alt={`Frame ${formatDuration(frame.time)}`} className="aspect-video w-full object-contain" />
                    <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">{duration > 0 ? Math.round(frame.time / duration * 100) : 0}%</span>
                    {coverTime === frame.time ? <span className="absolute bottom-1 left-1 rounded bg-accent-600 px-1.5 py-0.5 text-[9px] font-bold text-white">Gambar utama</span> : null}
                  </button>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-[10px] font-bold tabular-nums text-ink">{formatDuration(frame.time)}</span>
                    <button type="button" className="text-[10px] font-semibold text-rose-500 hover:underline" disabled={batchProgress !== null || busy} onClick={() => {
                      const next = frames.filter((item) => item.time !== frame.time);
                      setFrames(next);
                      setSelectedInterval(undefined);
                      if (coverTime === frame.time) setCoverTime(next[0]?.time);
                    }} aria-label={`Hapus frame ${formatDuration(frame.time)}`}>Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mt-2 rounded-xl border border-dashed border-line p-5 text-center text-[11px] text-ink-muted">Belum ada gambar. Pilih titik pada video lalu ambil gambar.</p>}
          {error ? <p className="mt-3 text-[11px] font-semibold text-rose-500" role="alert">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" className="app-button" onClick={onClose} disabled={busy}>Batal</button>
          <button type="button" className="app-button app-button-primary" onClick={() => void save()} disabled={!frames.length || busy || loadingFrames || batchProgress !== null}>
            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
            Simpan {frames.length} gambar
          </button>
        </div>
      </div>
    </div>
  );
}
