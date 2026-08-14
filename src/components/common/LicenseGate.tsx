import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { LicenseStatus } from "../../types";

interface Props { status?: LicenseStatus; busy: boolean; error?: string; onActivate: (email: string, code: string) => Promise<void>; }

export function LicenseGate({ status, busy, error, onActivate }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); await onActivate(email, code); };
  return <div className="flex min-h-screen items-center justify-center bg-surface-muted px-6">
    <form onSubmit={submit} className="w-full max-w-[460px] rounded-3xl border border-raspberry-100 bg-surface p-8 shadow-panel">
      <div className="mb-7 flex items-center gap-3"><img src="/metalizer-icon.png" alt="Metalizer" className="h-11 w-11 shrink-0 rounded-2xl object-cover shadow-raspberry" /><div><p className="eyebrow">Metalizer</p><h1 className="text-xl font-extrabold text-slate-900">Aktivasi lisensi</h1></div></div>
      <label className="mb-4 block"><span className="mb-1.5 block text-xs font-bold text-slate-700">Email lisensi</span><input className="app-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@contoh.com" autoComplete="email" required /></label>
      <label className="mb-5 block"><span className="mb-1.5 block text-xs font-bold text-slate-700">Kode lisensi</span><textarea className="min-h-[112px] w-full rounded-xl border border-raspberry-100 bg-surface px-3.5 py-3 font-mono text-xs text-slate-900 outline-none focus:border-raspberry-500 focus:ring-2 focus:ring-raspberry-500/15" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SLC1...." spellCheck={false} required /></label>
      {error || status?.message ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-800">{error ?? status?.message}</p> : null}
      <button className="app-button app-button-primary h-11 w-full" disabled={busy} type="submit">{busy ? "Memeriksa lisensi…" : "Aktifkan dan lanjutkan"}</button>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck size={13} /> Lisensi diverifikasi secara kriptografis di perangkat</p>
    </form>
  </div>;
}
