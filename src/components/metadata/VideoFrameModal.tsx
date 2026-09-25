import { convertFileSrc } from "@tauri-apps/api/core";
import { Check, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useRef, useState } from "react";

import { captureVideoFrame, formatDuration, MAX_VIDEO_FRAMES, seekToTime } from "../../services/video";
import type { StockAsset } from "../../types";

interface SelectedFrame {
  time: number;
  imageUrl: string;
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
  const [frames, setFrames] = useState<SelectedFrame[]>([]);
  const [coverTime, setCoverTime] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [error, setError] = useState<string>();

  const handleLoaded = async () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    const savedTimes = asset.videoFrameTimes ?? [];
    if (!savedTimes.length) return;
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
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const save = async () => {
    if (!frames.length || coverTime === undefined) return;
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
          <p className="mb-3 text-[12px] leading-5 text-ink-secondary">Geser video ke titik yang diinginkan, lalu pilih <b>Ambil gambar</b>. Pilih gambar utama untuk thumbnail. Semua gambar terpilih dipakai AI saat membuat metadata.</p>
          <div className="flex h-[300px] items-center justify-center overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              src={convertFileSrc(asset.path)}
              crossOrigin="anonymous"
              controls
              preload="auto"
              playsInline
              poster={asset.previewUrl}
              className="h-full max-w-full object-contain"
              onLoadedMetadata={() => void handleLoaded()}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onSeeking={() => setSeeking(true)}
              onSeeked={() => setSeeking(false)}
              onError={() => setError("Video tidak dapat dibuka. Periksa format, codec, atau akses file.")}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="w-11 text-[11px] font-bold tabular-nums text-ink">{formatDuration(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, duration - 0.05)}
              step={0.1}
              value={Math.min(currentTime, Math.max(0, duration - 0.05))}
              disabled={!duration || loadingFrames || busy}
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
          <button type="button" className="app-button app-button-primary mt-3 w-full" onClick={addFrame} disabled={!duration || loadingFrames || busy || seeking || frames.length >= MAX_VIDEO_FRAMES}>
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
                    {coverTime === frame.time ? <span className="absolute bottom-1 left-1 rounded bg-accent-600 px-1.5 py-0.5 text-[9px] font-bold text-white">Gambar utama</span> : null}
                  </button>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-[10px] font-bold tabular-nums text-ink">{formatDuration(frame.time)}</span>
                    <button type="button" className="text-[10px] font-semibold text-rose-500 hover:underline" onClick={() => {
                      const next = frames.filter((item) => item.time !== frame.time);
                      setFrames(next);
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
          <button type="button" className="app-button app-button-primary" onClick={() => void save()} disabled={!frames.length || busy || loadingFrames}>
            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
            Simpan {frames.length} gambar
          </button>
        </div>
      </div>
    </div>
  );
}
