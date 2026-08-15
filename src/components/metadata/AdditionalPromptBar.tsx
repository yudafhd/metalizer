import { ChevronDown, MessageSquareText } from "lucide-react";
import { useState } from "react";

interface AdditionalPromptBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function AdditionalPromptBar({ value, onChange }: AdditionalPromptBarProps) {
  const [isOpen, setIsOpen] = useState(Boolean(value.trim()));

  return (
    <section className="shrink-0 border-b border-line bg-surface px-6 py-2.5" aria-label="Konteks tambahan AI">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-[11px] font-extrabold uppercase tracking-wider text-accent-600 hover:text-accent-700 transition-colors"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="additional-prompt-input"
      >
        <MessageSquareText size={14} />
        <span>Konteks AI</span>
        {value.trim() ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold tracking-normal text-emerald-700">
            Aktif
          </span>
        ) : (
          <span className="font-medium normal-case tracking-normal text-ink-muted">Opsional</span>
        )}
        <ChevronDown size={14} className={`ml-auto text-accent-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? (
        <div className="mt-2.5 flex flex-col gap-1.5 md:flex-row md:items-start md:gap-4">
          <div className="min-w-0 flex-1">
            <textarea
              id="additional-prompt-input"
              className="app-input min-h-[48px] w-full resize-y text-[12px]"
              rows={2}
              maxLength={500}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Contoh: This is Japanese Marine Day, traditional celebration with sea lanterns."
              aria-label="Instruksi tambahan untuk AI"
            />
            <p className="mt-1 text-right text-[10px] font-medium text-ink-muted">{value.length}/500</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
