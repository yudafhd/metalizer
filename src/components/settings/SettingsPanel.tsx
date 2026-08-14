import { Activity, Eye, EyeOff, KeyRound, Save, ShieldCheck, Trash2, X, Zap } from "lucide-react";
import { useState } from "react";

import { GEMINI_MODELS } from "../../constants/models";
import type { ApiStatus, AppSettings, DailyUsage, MetadataMode } from "../../types";
import { formatTokenCount } from "../../services/usage";

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
      className="fixed inset-0 z-40 flex justify-end bg-slate-900/25 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="settings-sheet flex h-full w-[490px] flex-col border-l border-raspberry-100 bg-surface" role="dialog" aria-modal="true" aria-label="Pengaturan">
        <div className="flex h-[76px] items-center justify-between border-b border-raspberry-100 bg-surface px-6">
          <div>
            <p className="eyebrow">Pengaturan aplikasi</p>
            <h2 className="mt-1 text-[16px] font-extrabold text-slate-900">Preferensi & koneksi</h2>
          </div>
          <button className="app-button app-button-quiet h-8 w-8 px-0" onClick={onClose} aria-label="Tutup pengaturan">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {offline ? (
            <div className="mb-5 rounded-lg border border-amber-300 bg-amber-100/80 px-4 py-3 text-[12px] leading-5 text-amber-900">
              <b>Offline.</b> Metadata yang sudah ada tetap bisa diedit dan di-export. Generate AI butuh koneksi internet.
            </div>
          ) : null}

          <section>
            <SectionTitle icon={<KeyRound size={15} />} title="Koneksi AI" />
            <div className="mt-4 rounded-2xl border border-raspberry-100 bg-raspberry-50/40 p-4">
              <label className="text-[12px] font-bold text-slate-900">Gemini API key</label>
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
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? "Sembunyikan API key" : "Tampilkan API key"}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-3.5 flex items-center justify-between">
                <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${apiKeyVerified ? "text-emerald-700" : "text-slate-500"}`}>
                  <ShieldCheck size={14} />
                  {apiKeyVerified ? "Tersambung dan sudah dicek" : apiKeyConfigured ? "Tersimpan, koneksi belum dicek" : "API key belum diatur"}
                </span>
                <div className="flex gap-2">
                  <button className="app-button h-8 px-3 text-[11px]" disabled={(!apiKey.trim() && !apiKeyConfigured) || busy || offline} onClick={test}>
                    Tes
                  </button>
                  <button className="app-button app-button-primary h-8 px-3 text-[11px]" disabled={!apiKey.trim() || busy} onClick={save}>
                    <Save size={13} /> Simpan
                  </button>
                  {apiKeyConfigured ? (
                    <button className="app-button h-8 w-8 px-0 text-rose-700 hover:border-rose-300 hover:bg-rose-100" disabled={busy} onClick={remove} aria-label="Hapus API key">
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
              {status ? (
                <p className={`mt-3 rounded-lg px-3 py-2.5 text-[11px] leading-5 ${status.connected ? "bg-emerald-100/70 border border-emerald-300 text-emerald-900 font-medium" : "bg-rose-100/70 border border-rose-300 text-rose-900 font-medium"}`}>
                  {status.message ?? (status.connected ? "Tersambung ke Gemini." : "Koneksi gagal.")}
                </p>
              ) : null}
            </div>
          </section>

          <section className="mt-7">
            <SectionTitle icon={<Activity size={15} />} title="Pemakaian Gemini hari ini" />
            <div className="mt-4 rounded-2xl border border-raspberry-100 bg-raspberry-50/40 p-4">
              <div className="grid grid-cols-3 gap-2">
                <UsageMetric label="Request" value={String(dailyUsage.requests)} />
                <UsageMetric label="Token masuk" value={formatTokenCount(dailyUsage.promptTokens)} />
                <UsageMetric label="Token keluar" value={formatTokenCount(dailyUsage.outputTokens)} />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-raspberry-100 bg-surface px-3 py-2.5">
                <span className="text-[11px] font-semibold text-slate-600">Total token hari ini</span>
                <span className="text-[13px] font-extrabold text-raspberry-700">{formatTokenCount(dailyUsage.totalTokens)}</span>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-slate-500">Dicatat secara lokal dari respons Gemini yang berhasil. Batas asli Google bergantung pada project dan model yang dipilih.</p>
            </div>
          </section>

          <section className="mt-7">
            <SectionTitle icon={<Zap size={15} />} title="Generate" />
            <div className="mt-4 space-y-4 rounded-2xl border border-raspberry-100 bg-raspberry-50/40 p-4">
              <Field label="Model AI">
                <select
                  className="app-select text-[13px]"
                  value={settings.modelPreset}
                  onChange={(event) => {
                    const preset = event.target.value as AppSettings["modelPreset"];
                    update({ modelPreset: preset, model: preset === "balanced" ? GEMINI_MODELS.balanced : preset === "fast" ? GEMINI_MODELS.fast : settings.model });
                  }}
                >
                  <option value="balanced">Seimbang · Gemini 3.5 Flash Lite</option>
                  <option value="fast">Cepat · Gemini 3.1 Flash Lite</option>
                  <option value="custom">ID model khusus</option>
                </select>
              </Field>
              {settings.modelPreset === "custom" ? (
                <Field label="Custom model ID">
                  <input className="app-input text-[13px]" value={settings.customModel} onChange={(event) => update({ customModel: event.target.value })} placeholder="gemini-3.5-flash-lite" />
                </Field>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jumlah per batch">
                  <select className="app-select text-[13px]" value={settings.batchSize} onChange={(event) => update({ batchSize: Number(event.target.value) as AppSettings["batchSize"] })}>
                    {[1, 2, 3, 4, 5, 6].map((value) => (
                      <option key={value} value={value}>
                        {value} aset per contact sheet
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Request bersamaan">
                  <select className="app-select text-[13px]" value={settings.concurrency} onChange={(event) => update({ concurrency: Number(event.target.value) as AppSettings["concurrency"] })}>
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
                  <select className="app-select text-[13px]" value={settings.metadataMode} onChange={(event) => update({ metadataMode: event.target.value as MetadataMode })}>
                    <option value="strict">Ketat</option>
                    <option value="balanced">Seimbang</option>
                    <option value="discovery">Eksplorasi</option>
                  </select>
                </Field>
                <Field label="Jumlah keywords">
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
              <p className="-mt-1 text-[10px] leading-4 text-slate-500">Pilih 20–35 keyword yang paling relevan. Keyword tambahan yang terlalu umum akan dibuang saat Generate.</p>
            </div>
          </section>

          <section className="mt-7">
            <SectionTitle title="Image processing" />
            <div className="mt-4 space-y-4 rounded-2xl border border-raspberry-100 bg-raspberry-50/40 p-4">
              <div>
                <div className="flex justify-between text-[12px] font-semibold text-slate-900">
                  <span>Kualitas contact sheet</span>
                  <span className="font-bold text-raspberry-700">{settings.contactSheetQuality}</span>
                </div>
                <input
                  className="mt-2 w-full accent-raspberry-600"
                  type="range"
                  min={60}
                  max={95}
                  value={settings.contactSheetQuality}
                  onChange={(event) => update({ contactSheetQuality: Number(event.target.value) })}
                />
              </div>
              <Field label="Ukuran maksimal contact sheet">
                <select className="app-select text-[13px]" value={settings.maxSheetSize} onChange={(event) => update({ maxSheetSize: Number(event.target.value) })}>
                  <option value={1536}>1536 px</option>
                  <option value={2048}>2048 px</option>
                  <option value={2560}>2560 px</option>
                </select>
              </Field>
              <Field label="Latar belakang">
                <select className="app-select text-[13px]" value={settings.background} onChange={(event) => update({ background: event.target.value as AppSettings["background"] })}>
                  <option value="neutral">Netral</option>
                  <option value="white">Putih</option>
                  <option value="gray">Abu-abu</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="mt-7">
            <SectionTitle title="Export" />
            <div className="mt-4 rounded-2xl border border-raspberry-100 bg-raspberry-50/40 p-4">
              <ToggleRow label="Sertakan kolom Releases" value={settings.includeReleases} onChange={(value) => update({ includeReleases: value })} />
              <p className="mt-3 text-[11px] leading-5 text-slate-500">CSV dibuat dengan encoding UTF-8 dan format yang aman. Export besar otomatis dibagi setiap 5.000 baris atau sekitar 1 MB.</p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
      {icon ? <span className="text-raspberry-600">{icon}</span> : null}
      {title}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-raspberry-600">{label}</span>
      {children}
    </label>
  );
}

function UsageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-raspberry-100 bg-surface px-3 py-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-raspberry-600">{label}</p>
      <p className="mt-1 text-[17px] font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-semibold text-slate-800">{label}</span>
      <button
        className={`relative h-5 w-9 rounded-full transition ${value ? "bg-raspberry-600" : "bg-slate-300"}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${value ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
