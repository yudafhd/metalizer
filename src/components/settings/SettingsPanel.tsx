import { Activity, Eye, EyeOff, KeyRound, Save, ShieldCheck, Sliders, Trash2, X, Zap } from "lucide-react";
import { useState } from "react";

import { GEMINI_MODELS } from "../../constants/models";
import type { ApiStatus, AppSettings, DailyUsage, MetadataMode } from "../../types";
import { formatTokenCount, remainingTokenBudget, tokenBudgetPercent } from "../../services/usage";

interface SettingsPanelProps {
  settings: AppSettings;
  apiKeyConfigured: boolean;
  apiKeyVerified: boolean;
  dailyUsage: DailyUsage;
  offline: boolean;
  onSettingsChange: (settings: AppSettings) => void;
  onSaveApiKey: (value: string) => Promise<void>;
  onDeleteApiKey: () => Promise<void>;
  onTestApiKey: (value: string) => Promise<ApiStatus>;
  onClose: () => void;
}

export function SettingsPanel({
  settings,
  apiKeyConfigured,
  apiKeyVerified,
  dailyUsage,
  offline,
  onSettingsChange,
  onSaveApiKey,
  onDeleteApiKey,
  onTestApiKey,
  onClose,
}: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<ApiStatus | undefined>();
  const [busy, setBusy] = useState(false);

  const update = (patch: Partial<AppSettings>) => onSettingsChange({ ...settings, ...patch });
  const remainingTokens = remainingTokenBudget(dailyUsage, settings.dailyTokenBudget);
  const budgetPercent = tokenBudgetPercent(dailyUsage, settings.dailyTokenBudget);

  const test = async () => {
    setBusy(true);
    try {
      setStatus(await onTestApiKey(apiKey));
    } catch (error) {
      setStatus({ connected: false, status: "failed", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!apiKey.trim()) return;
    setBusy(true);
    try {
      await onSaveApiKey(apiKey);
      setApiKey("");
      setStatus({ connected: true, status: "connected", message: "API key berhasil disimpan dengan aman." });
    } catch (error) {
      setStatus({ connected: false, status: "failed", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await onDeleteApiKey();
      setStatus({ connected: false, status: "failed", message: "API key sudah dihapus." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink/35 backdrop-blur-sm transition-all"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="settings-sheet flex h-full w-[520px] flex-col border-l border-line bg-surface shadow-modal animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Pengaturan"
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-line bg-surface px-6">
          <div>
            <p className="eyebrow">Pengaturan aplikasi</p>
            <h2 className="mt-0.5 text-[16px] font-extrabold text-ink">Preferensi & AI</h2>
          </div>
          <button className="app-button app-button-quiet h-8 w-8 px-0" onClick={onClose} aria-label="Tutup pengaturan">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
          {offline ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] leading-5 text-ink">
              <b className="text-amber-500 font-extrabold">Offline.</b> Metadata yang sudah ada tetap bisa diedit dan di-export. Fitur Generate AI membutuhkan koneksi internet.
            </div>
          ) : null}

          {/* AI Connection */}
          <section>
            <SectionTitle icon={<KeyRound size={15} />} title="Koneksi Gemini AI" />
            <div className="mt-3 rounded-2xl border border-line bg-surface-sunken/40 p-4">
              <label className="text-[12px] font-bold text-ink">Gemini API key</label>
              <div className="relative mt-2">
                <input
                  className="app-input pr-10 text-[13px]"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={apiKeyConfigured ? "Tersimpan aman di Stronghold" : "Tempel Gemini API key"}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-2.5 text-ink-muted hover:text-ink transition-colors"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? "Sembunyikan API key" : "Tampilkan API key"}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {status ? (
                <p
                  className={`mt-3 rounded-xl px-3 py-2.5 text-[11px] leading-5 ${
                    status.connected
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium"
                      : "bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-medium"
                  }`}
                >
                  {status.message ?? (status.connected ? "Tersambung ke Gemini." : "Koneksi gagal.")}
                </p>
              ) : null}

              <div className="mt-3 flex items-center justify-between">
                <span
                  className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                    apiKeyVerified ? "text-emerald-500" : apiKeyConfigured ? "text-accent-500" : "text-ink-muted"
                  }`}
                >
                  <ShieldCheck size={14} />
                  {apiKeyVerified ? "Tersambung dan aktif" : apiKeyConfigured ? "Tersimpan, belum dicek" : "API key belum diatur"}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="app-button h-8 px-3 text-[11px]"
                    disabled={(!apiKey.trim() && !apiKeyConfigured) || busy || offline}
                    onClick={test}
                  >
                    Tes
                  </button>
                  <button
                    type="button"
                    className="app-button app-button-primary h-8 px-3 text-[11px]"
                    disabled={!apiKey.trim() || busy}
                    onClick={save}
                  >
                    <Save size={13} /> Simpan
                  </button>
                  {apiKeyConfigured ? (
                    <button
                      type="button"
                      className="app-button h-8 w-8 px-0 text-rose-500 hover:border-rose-300 hover:bg-rose-500/10"
                      disabled={busy}
                      onClick={remove}
                      aria-label="Hapus API key"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* Usage Today */}
          <section>
            <SectionTitle icon={<Activity size={15} />} title="Pemakaian Gemini hari ini" />
            <div className="mt-3 rounded-2xl border border-line bg-surface-sunken/40 p-4">
              <div className="grid grid-cols-3 gap-2">
                <UsageMetric label="Request" value={String(dailyUsage.requests)} />
                <UsageMetric label="Token masuk" value={formatTokenCount(dailyUsage.promptTokens)} />
                <UsageMetric label="Token keluar" value={formatTokenCount(dailyUsage.outputTokens)} />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5">
                <span className="text-[11px] font-semibold text-ink-secondary">Total token hari ini</span>
                <span className="text-[13px] font-extrabold text-accent-500">{formatTokenCount(dailyUsage.totalTokens)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-accent-600">Estimasi sisa</p>
                  <p className="mt-0.5 text-[16px] font-extrabold text-ink">
                    {remainingTokens === null ? "—" : formatTokenCount(remainingTokens)}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-accent-600">Budget lokal</p>
                  <p className="mt-0.5 text-[16px] font-extrabold text-ink">
                    {settings.dailyTokenBudget > 0 ? formatTokenCount(settings.dailyTokenBudget) : "Off"}
                  </p>
                </div>
              </div>
              {budgetPercent !== null ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-bold text-ink-muted">
                    <span>Budget terpakai</span>
                    <span>{budgetPercent}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full rounded-full transition-all ${budgetPercent >= 95 ? "bg-rose-500" : budgetPercent >= 80 ? "bg-amber-500" : "bg-accent-600"}`}
                      style={{ width: `${budgetPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}
              <div className="mt-3">
                <Field label="Budget token lokal per hari (0 = tidak dibatasi)">
                  <input
                    className="app-input text-[13px]"
                    type="number"
                    min={0}
                    step={1000}
                    value={settings.dailyTokenBudget}
                    onChange={(event) => update({ dailyTokenBudget: Math.max(0, Math.floor(Number(event.target.value) || 0)) })}
                  />
                </Field>
              </div>
              {dailyUsage.lastErrorKind ? (
                <p className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[10px] leading-4 text-amber-800">
                  Error Gemini terakhir: <b>{dailyUsage.lastErrorKind}</b>. {dailyUsage.lastErrorMessage}
                </p>
              ) : null}
              <p className="mt-2.5 text-[10px] leading-4 text-ink-muted">
                Token dicatat lokal dari respons Gemini yang berhasil. Sisa di atas adalah estimasi berdasarkan budget lokal, bukan quota server Gemini.
              </p>
            </div>
          </section>

          {/* Generation Settings */}
          <section>
            <SectionTitle icon={<Zap size={15} />} title="Parameter Generate" />
            <div className="mt-3 space-y-3.5 rounded-2xl border border-line bg-surface-sunken/40 p-4">
              <Field label="Model AI">
                <select
                  className="app-select text-[13px]"
                  value={settings.modelPreset}
                  onChange={(event) => {
                    const preset = event.target.value as AppSettings["modelPreset"];
                    update({
                      modelPreset: preset,
                      model: preset === "balanced"
                        ? GEMINI_MODELS.balanced
                        : preset === "fast"
                          ? GEMINI_MODELS.fast
                          : preset === "population"
                            ? GEMINI_MODELS.population
                            : preset === "populationPro"
                              ? GEMINI_MODELS.populationPro
                              : settings.model,
                    });
                  }}
                >
                  <option value="balanced">Seimbang · Gemini 3.5 Flash Lite</option>
                  <option value="fast">Cepat · Gemini 3.1 Flash Lite</option>
                  <option value="population">Population · Gemini 3.6 Flash</option>
                  <option value="populationPro">Population Pro · Gemini 3.1 Pro Preview (API berbayar)</option>
                  <option value="custom">ID model khusus</option>
                </select>
              </Field>

              {settings.modelPreset === "custom" ? (
                <Field label="Custom model ID">
                  <input
                    className="app-input text-[13px]"
                    value={settings.customModel}
                    onChange={(event) => update({ customModel: event.target.value })}
                    placeholder="gemini-3.5-flash-lite"
                  />
                </Field>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Jumlah per batch">
                  <select
                    className="app-select text-[13px]"
                    value={settings.batchSize}
                    onChange={(event) => update({ batchSize: Number(event.target.value) as AppSettings["batchSize"] })}
                  >
                    {[1, 2, 3, 4, 5, 6].map((value) => (
                      <option key={value} value={value}>
                        {value} aset per sheet
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Request bersamaan">
                  <select
                    className="app-select text-[13px]"
                    value={settings.concurrency}
                    onChange={(event) => update({ concurrency: Number(event.target.value) as AppSettings["concurrency"] })}
                  >
                    {[1, 2, 3].map((value) => (
                      <option key={value} value={value}>
                        {value} bersamaan
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Gaya metadata">
                  <select
                    className="app-select text-[13px]"
                    value={settings.metadataMode}
                    onChange={(event) => update({ metadataMode: event.target.value as MetadataMode })}
                  >
                    <option value="strict">Ketat</option>
                    <option value="balanced">Seimbang</option>
                    <option value="discovery">Eksplorasi</option>
                  </select>
                </Field>
                <Field label="Target keyword">
                  <input
                    className="app-input text-[13px]"
                    type="number"
                    min={20}
                    max={35}
                    value={settings.targetKeywords}
                    onChange={(event) => update({ targetKeywords: Math.max(20, Math.min(35, Number(event.target.value))) })}
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* Image Processing */}
          <section>
            <SectionTitle icon={<Sliders size={15} />} title="Pemrosesan Contact Sheet" />
            <div className="mt-3 space-y-3.5 rounded-2xl border border-line bg-surface-sunken/40 p-4">
              <div>
                <div className="flex justify-between text-[12px] font-semibold text-ink">
                  <span>Kualitas contact sheet</span>
                  <span className="font-bold text-accent-500">{settings.contactSheetQuality}%</span>
                </div>
                <input
                  className="mt-2 w-full accent-accent-600"
                  type="range"
                  min={60}
                  max={95}
                  value={settings.contactSheetQuality}
                  onChange={(event) => update({ contactSheetQuality: Number(event.target.value) })}
                />
              </div>

              <Field label="Ukuran maksimal contact sheet">
                <select
                  className="app-select text-[13px]"
                  value={settings.maxSheetSize}
                  onChange={(event) => update({ maxSheetSize: Number(event.target.value) })}
                >
                  <option value={1536}>1536 px</option>
                  <option value={2048}>2048 px</option>
                  <option value={2560}>2560 px</option>
                </select>
              </Field>

              <Field label="Latar belakang sheet">
                <select
                  className="app-select text-[13px]"
                  value={settings.background}
                  onChange={(event) => update({ background: event.target.value as AppSettings["background"] })}
                >
                  <option value="neutral">Netral</option>
                  <option value="white">Putih</option>
                  <option value="gray">Abu-abu</option>
                </select>
              </Field>
            </div>
          </section>

          {/* Export Options */}
          <section>
            <div className="rounded-2xl border border-line bg-surface-sunken/40 p-4">
              <ToggleRow
                label="Sertakan kolom Releases pada CSV"
                value={settings.includeReleases}
                onChange={(value) => update({ includeReleases: value })}
              />
              <p className="mt-2.5 text-[11px] leading-5 text-ink-muted">
                File CSV di-encode dengan UTF-8 standar Adobe Stock. Export batch besar otomatis dibagi per 5.000 baris.
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
      {icon ? <span className="text-accent-600">{icon}</span> : null}
      {title}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-accent-600">{label}</span>
      {children}
    </label>
  );
}

function UsageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-accent-600">{label}</p>
      <p className="mt-0.5 text-[16px] font-extrabold text-ink">{value}</p>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-semibold text-ink">{label}</span>
      <button
        type="button"
        className={`relative h-5 w-9 rounded-full transition-colors ${value ? "bg-accent-600" : "bg-line"}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            value ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
