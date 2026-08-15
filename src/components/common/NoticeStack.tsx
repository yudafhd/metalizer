import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import type { Notice } from "../../stores/appStore";

export function NoticeStack({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[360px] flex-col gap-2">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-modal backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 ${
            notice.tone === "error"
              ? "border-rose-500/40 bg-surface text-rose-400"
              : notice.tone === "warning"
              ? "border-amber-500/40 bg-surface text-amber-400"
              : notice.tone === "success"
              ? "border-emerald-500/40 bg-surface text-emerald-400"
              : "border-line bg-surface text-ink"
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {notice.tone === "error" || notice.tone === "warning" ? (
              <AlertTriangle size={15} />
            ) : notice.tone === "success" ? (
              <CheckCircle2 size={15} />
            ) : (
              <Info size={15} />
            )}
          </span>
          <p className="flex-1 text-[11px] font-medium leading-4 text-ink">{notice.message}</p>
          <button
            onClick={() => onDismiss(notice.id)}
            aria-label="Tutup notifikasi"
            className="text-ink-muted hover:text-ink transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
