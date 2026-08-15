import { Check, Moon, Palette, Sparkles, Sun, X } from "lucide-react";
import { useState } from "react";

import { APP_THEMES } from "../../constants/themes";
import type { AppTheme } from "../../types";

interface ThemeSheetProps {
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  onClose: () => void;
}

export function ThemeSheet({ currentTheme, onSelectTheme, onClose }: ThemeSheetProps) {
  const [filter, setFilter] = useState<"all" | "fantasy" | "dark" | "light">("all");

  const filteredThemes = APP_THEMES.filter((t) => {
    if (filter === "fantasy") return t.category === "Fantasy";
    if (filter === "dark") return t.mode === "dark" && t.category !== "Fantasy";
    if (filter === "light") return t.mode === "light" && t.category !== "Fantasy";
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink/35 backdrop-blur-sm transition-all"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="settings-sheet flex h-full w-[540px] flex-col border-l border-line bg-surface shadow-modal animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Pilih Tema"
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-line bg-surface px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <Palette size={20} />
            </div>
            <div>
              <p className="eyebrow">Koleksi Desain</p>
              <h2 className="mt-0.5 text-[16px] font-extrabold text-ink">Pilih Tema & Tampilan</h2>
            </div>
          </div>
          <button className="app-button app-button-quiet h-8 w-8 px-0" onClick={onClose} aria-label="Tutup pemilih tema">
            <X size={18} />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 border-b border-line bg-surface-sunken/50 px-6 py-3">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1 text-[11px] font-bold transition ${
              filter === "all" ? "bg-surface text-ink shadow-sm border border-line" : "text-ink-muted hover:text-ink"
            }`}
          >
            Semua ({APP_THEMES.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("fantasy")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-bold transition ${
              filter === "fantasy" ? "bg-surface text-accent-600 shadow-sm border border-line" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Sparkles size={12} /> Fantasi ({APP_THEMES.filter((t) => t.category === "Fantasy").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("dark")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-bold transition ${
              filter === "dark" ? "bg-surface text-ink shadow-sm border border-line" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Moon size={12} /> Gelap ({APP_THEMES.filter((t) => t.mode === "dark" && t.category !== "Fantasy").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("light")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-bold transition ${
              filter === "light" ? "bg-surface text-ink shadow-sm border border-line" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Sun size={12} /> Lembut ({APP_THEMES.filter((t) => t.mode === "light" && t.category !== "Fantasy").length})
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3">
            {filteredThemes.map((theme) => {
              const isActive = currentTheme === theme.value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => onSelectTheme(theme.value)}
                  className={`group relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
                    isActive
                      ? "border-accent-500 bg-surface shadow-md ring-2 ring-accent-400/50 scale-[1.01]"
                      : "border-line bg-surface/80 hover:border-accent-300 hover:bg-surface hover:shadow-sm"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    {theme.gradient ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-4 w-12 rounded-full border border-black/20 shadow-inner"
                          style={{
                            backgroundImage: `linear-gradient(90deg, ${theme.gradient[0]} 0%, ${theme.gradient[1]} 50%, ${theme.gradient[2]} 100%)`,
                          }}
                        />
                        <span className="rounded bg-accent-500/10 px-1 py-0.5 text-[8px] font-black text-accent-600">
                          3-COLOR
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-4 w-4 rounded-full border border-black/20 shadow-inner"
                          style={{ backgroundColor: theme.preview.accent }}
                        />
                        <span
                          className="h-4 w-4 -ml-1.5 rounded-full border border-black/20 shadow-inner"
                          style={{ backgroundColor: theme.preview.bg }}
                        />
                        <span
                          className="h-4 w-4 -ml-1.5 rounded-full border border-black/20 shadow-inner"
                          style={{ backgroundColor: theme.preview.surface }}
                        />
                      </div>
                    )}
                    {isActive ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-600 text-white shadow-sm">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    ) : theme.mode === "dark" ? (
                      <span className="rounded bg-line-subtle px-1.5 py-0.5 text-[9px] font-bold text-ink-muted">Dark</span>
                    ) : null}
                  </div>
                  <span className="mt-3 text-[13px] font-extrabold text-ink leading-tight">{theme.label}</span>
                  <span className="mt-1 text-[11px] leading-4 text-ink-muted line-clamp-2">{theme.detail}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-line bg-surface px-6 py-3.5">
          <p className="text-[11px] font-medium text-ink-muted">Tema aktif: <b className="text-accent-600">{APP_THEMES.find(t => t.value === currentTheme)?.label}</b></p>
          <button className="app-button app-button-primary h-8 px-4 text-[11px]" onClick={onClose}>
            Selesai
          </button>
        </div>
      </section>
    </div>
  );
}
