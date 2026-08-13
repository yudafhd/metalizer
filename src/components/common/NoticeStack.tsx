import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import type { Notice } from "../../stores/appStore";

export function NoticeStack({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: string) => void }) {
  return <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[360px] flex-col gap-2">{notices.map((notice) => <div key={notice.id} className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-3 shadow-lg ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : notice.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line bg-white text-ink"}`}><span className="mt-0.5 shrink-0">{notice.tone === "error" || notice.tone === "warning" ? <AlertTriangle size={14} /> : notice.tone === "success" ? <CheckCircle2 size={14} /> : <Info size={14} />}</span><p className="flex-1 text-[11px] leading-4">{notice.message}</p><button onClick={() => onDismiss(notice.id)} aria-label="Dismiss notification"><X size={14} /></button></div>)}</div>;
}
