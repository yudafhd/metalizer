import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { LicenseStatus } from "../../types";

interface Props {
  status?: LicenseStatus;
  busy: boolean;
  error?: string;
  onActivate: (email: string, code: string) => Promise<void>;
}

export function LicenseGate({ status, busy, error, onActivate }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onActivate(email, code);
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"
      style={{ background: "var(--page-background)" }}
    >
      <div className="pointer-events-none absolute -left-32 -top-40 h-[480px] w-[480px] rounded-full bg-accent-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-28 h-[540px] w-[540px] rounded-full bg-accent-600/15 blur-3xl" />

      <form
        onSubmit={submit}
        className="relative w-full max-w-[460px] rounded-3xl border border-line bg-surface p-8 shadow-modal"
      >
        <div className="mb-6 flex items-center gap-3.5">
          <img src="/metalizer-icon.png" alt="Metalizer" className="h-11 w-11 shrink-0 rounded-2xl object-cover shadow-accent" />
          <div>
            <p className="eyebrow">Metalizer</p>
            <h1 className="text-xl font-extrabold text-ink">Aktivasi Lisensi</h1>
          </div>
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-bold text-ink-secondary">Email lisensi</span>
          <input
            className="app-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@contoh.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-1.5 block text-xs font-bold text-ink-secondary">Kode lisensi</span>
          <textarea
            className="app-input min-h-[112px] font-mono text-xs"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SLC1...."
            spellCheck={false}
            required
          />
        </label>

        {error || status?.message ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs leading-5 text-rose-800 font-medium">
            {error ?? status?.message}
          </p>
        ) : null}

        <button className="app-button app-button-primary h-11 w-full" disabled={busy} type="submit">
          {busy ? "Memeriksa lisensi…" : "Aktifkan dan lanjutkan"}
        </button>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-ink-muted">
          <ShieldCheck size={14} className="text-accent-600" /> Lisensi diverifikasi secara kriptografis di perangkat
        </p>
      </form>
    </div>
  );
}
