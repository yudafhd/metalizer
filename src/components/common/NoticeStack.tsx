import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import type { Notice } from "../../stores/appStore";

export function NoticeStack({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: string) => void }) {
  return <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[360px] flex-col gap-2">{notices.map((notice) => <div key={notice.id} className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-xl backdrop-blur-md ${notice.tone === "error" ? "border-rose-300 bg-rose-100/95 text-rose-950" : notice.tone === "warning" ? "border-amber-300 bg-amber-100/95 text-amber-950" : notice.tone === "success" ? "border-emerald-300 bg-emerald-100/95 text-emerald-950" : "border-slate-300 bg-slate-100/95 text-slate-900"}`}><span className="mt-0.5 shrink-0">{notice.tone === "error" || notice.tone === "warning" ? <AlertTriangle size={14} /> : notice.tone === "success" ? <CheckCircle2 size={14} /> : <Info size={14} />}</span><p className="flex-1 text-[11px] font-medium leading-4">{notice.message}</p><button onClick={() => onDismiss(notice.id)} aria-label="Tutup notifikasi" className="opacity-70 hover:opacity-100"><X size={14} /></button></div>)}</div>;
}
