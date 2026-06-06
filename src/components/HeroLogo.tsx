export function HeroLogo() {
  return (
    <header className="relative overflow-hidden rounded-[32px] border border-cyan-200/20 bg-[radial-gradient(circle_at_18%_24%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_92%_30%,rgba(59,130,246,0.22),transparent_26%),linear-gradient(135deg,#020617_0%,#061121_42%,#020617_100%)] px-6 py-6 shadow-[0_32px_110px_rgba(2,6,23,0.58),inset_0_1px_0_rgba(165,243,252,0.18)] sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-cyan-300/15" />
      <div className="pointer-events-none absolute -left-24 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-blue-500/12 blur-3xl" />

      <div className="relative grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-center">
        <div>
          <h1 className="flex flex-nowrap items-center justify-center gap-x-3 whitespace-nowrap text-[clamp(1.85rem,5.5vw,4.7rem)] font-black uppercase leading-none tracking-[0.08em] lg:justify-start">
            <span className="bg-[linear-gradient(180deg,#ffffff_0%,#e0f2fe_54%,#94a3b8_100%)] bg-clip-text text-transparent">
              Merge
            </span>
            <span className="bg-[linear-gradient(180deg,#ecfeff_0%,#67e8f9_48%,#06b6d4_100%)] bg-clip-text text-transparent">
              Medic
            </span>
            <span className="rounded-2xl border border-cyan-200/70 bg-cyan-300/8 px-3 py-1 text-[0.62em] leading-none text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
              AI
            </span>
          </h1>

          <div className="mt-4 text-orange-300">
            <svg
              className="h-9 w-full drop-shadow-[0_0_8px_rgba(249,115,22,0.85)]"
              viewBox="0 0 720 42"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M0 22H304L312 13L319 30L330 2L342 40L352 22H720"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="mt-3 text-center text-sm uppercase tracking-[0.32em] text-slate-300 sm:text-base">
            Diagnose risky <span className="text-orange-300">code</span> before
            you merge
          </p>
        </div>

        <p className="border-cyan-200/20 text-base leading-7 text-slate-100 lg:border-l lg:pl-7">
          An automated code review agent, integrated with{" "}
          <span className="text-orange-300">GitLab</span> and{" "}
          <span className="text-orange-300">Jira</span>, powered by{" "}
          <span className="text-orange-300">AI</span>, and ready to 
          supercharge your peer-review workflow. Your
          second set of eyes before code reaches customers.
        </p>
      </div>
    </header>
  );
}
