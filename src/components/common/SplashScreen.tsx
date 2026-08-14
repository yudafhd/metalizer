export function SplashScreen() {
  return (
    <main className="relative flex h-screen min-w-[1100px] items-center justify-center overflow-hidden bg-[#07152f] text-white" role="status" aria-label="Metalizer sedang dimuat">
      <div className="pointer-events-none absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-28 h-[560px] w-[560px] rounded-full bg-cyan-500/15 blur-3xl" />

      <section className="relative flex w-[360px] flex-col items-center text-center">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <div className="absolute inset-0 rounded-[30px] shadow-[0_0_50px_rgba(37,99,235,0.55)] splash-logo-ring" />
          <img src="/metalizer-icon.png" alt="Metalizer" className="relative h-32 w-32 rounded-[26px] object-cover shadow-[0_20px_48px_-16px_rgba(0,0,0,0.85)]" />
        </div>
        <h1 className="mt-8 text-[34px] font-black tracking-tight text-white">Metalizer</h1>
        <div className="mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-blue-950/90 ring-1 ring-blue-300/15">
          <div className="splash-progress h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-300 to-amber-300" />
        </div>
        <p className="mt-4 text-[11px] font-semibold text-blue-100/65">Menyiapkan workspace...</p>
        <span className="mt-5 rounded-full border border-amber-300/25 bg-amber-200/10 px-2.5 py-1 text-[9px] font-extrabold tracking-[0.16em] text-amber-200">VERSI 0.1.0</span>
      </section>
    </main>
  );
}
