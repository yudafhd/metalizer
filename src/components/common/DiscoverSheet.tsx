import { useEffect } from "react";
import { ArrowUpRight, Bell, LoaderCircle, RefreshCw, X } from "lucide-react";
import type { DiscoverItem } from "../../services/discover";
import { openUrl } from "../../services/tauri";

interface Props {
  items: DiscoverItem[];
  unreadIds: Set<string>;
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onClose: () => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function DiscoverSheet({ items, unreadIds, loading, error, onRefresh, onClose }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink/35 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        className="settings-sheet flex h-full w-full max-w-[620px] flex-col border-l border-line bg-surface shadow-modal animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discover-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
              <Bell size={20} />
            </div>
            <div className="min-w-0">
              <h2 id="discover-title" className="mt-0.5 text-[18px] font-extrabold text-ink">Discover</h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className="app-button app-button-quiet h-9 w-9 px-0" onClick={onRefresh} disabled={loading} aria-label="Perbarui Discover" title="Perbarui Discover">
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
            <button type="button" className="app-button app-button-quiet h-9 w-9 px-0" onClick={onClose} aria-label="Tutup Discover">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunken/40 px-6 py-5">          {error ? (
            <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[12px] text-ink">
              {error} <button type="button" className="font-bold text-accent-600 underline" onClick={onRefresh}>Coba lagi</button>
            </div>
          ) : null}
          {loading && !items.length ? (
            <div className="flex items-center justify-center gap-2 py-14 text-[12px] font-medium text-ink-muted"><LoaderCircle size={17} className="animate-spin" /> Memuat kabar...</div>
          ) : !items.length && !error ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-[12px] text-ink-muted">Belum ada kabar untuk ditampilkan.</div>
          ) : null}
          <div className="space-y-4">
            {items.map((item) => (
              <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm sm:flex-row">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" loading="lazy" className="h-32 w-full shrink-0 bg-surface-sunken object-cover sm:m-3 sm:h-28 sm:w-28 sm:rounded-xl" />
                ) : null}
                <div className="min-w-0 flex-1 p-5">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    <span className="rounded-full bg-accent-50 px-2.5 py-1 text-accent-700">{item.type === "note" ? "Pengumuman" : item.type}</span>
                    {unreadIds.has(item.id) ? <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-600">Baru</span> : null}
                    {formatDate(item.createdAt) ? <span className="text-ink-muted">{formatDate(item.createdAt)}</span> : null}
                  </div>
                  <h3 className="text-[15px] font-extrabold leading-snug text-ink">{item.title}</h3>
                  {item.description ? <p className="mt-2 whitespace-pre-line text-[12px] leading-5 text-ink-secondary">{item.description}</p> : null}
                  {item.note ? <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2 text-[11px] leading-5 text-ink-muted">{item.note}</p> : null}
                  {item.link ? (
                    <button type="button" className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-accent-600 hover:underline" onClick={() => void openUrl(item.link!)}>
                      Buka tautan <ArrowUpRight size={14} />
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
