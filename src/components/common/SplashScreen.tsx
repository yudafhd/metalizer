export function SplashScreen() {
  return (
    <main
      className="relative flex h-screen min-w-[1100px] items-center justify-center overflow-hidden text-ink"
      style={{ background: "var(--page-background)" }}
      role="status"
      aria-label="Metalizer sedang dimuat"
    >
      <div className="pointer-events-none absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-accent-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-28 h-[560px] w-[560px] rounded-full bg-accent-600/15 blur-3xl" />

      <section className="relative flex w-[360px] flex-col items-center text-center">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <div className="absolute inset-0 rounded-[30px] shadow-glow splash-logo-ring" />
          <img
            src="/metalizer-icon.png"
            alt="Metalizer"
            className="relative h-32 w-32 rounded-[26px] object-cover shadow-panel"
          />
        </div>
        <h1 className="mt-8 text-[34px] font-black tracking-tight text-ink">Metalizer</h1>
        <div className="mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-accent-900/15 ring-1 ring-accent-300/30">
          <div className="splash-progress h-full rounded-full bg-gradient-to-r from-accent-600 via-accent-500 to-accent-300" />
        </div>
        <p className="mt-4 text-[11px] font-semibold text-ink-muted">Menyiapkan workspace...</p>
        <span className="mt-5 rounded-full border border-accent-300/50 bg-accent-50/80 px-3 py-1 text-[9px] font-extrabold tracking-[0.16em] text-accent-700">
          VERSI 0.2.0
        </span>

      </section>
    </main>
  );
}
