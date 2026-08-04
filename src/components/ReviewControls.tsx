import { useEffect, useState } from "react";

interface ReviewControlsProps {
  onGenerate: () => void;
  onPackageData: () => void;
  loading: boolean;
  canGenerate: boolean;
}

export function ReviewControls({
  onGenerate,
  onPackageData,
  loading,
  canGenerate,
}: ReviewControlsProps) {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setDotCount((current) => (current + 1) % 4);
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [loading]);

  const buttonLabel = loading
    ? `Thinking${".".repeat(dotCount)}`
    : "Generate AI Review";

  function handleGenerate() {
    setDotCount(0);
    onGenerate();
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm text-slate-100">
          Generate high-value findings using the loaded merge request, Jira
          context, diff hunks, changed file contents, and bounded related-file
          retrieval.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !canGenerate}
          className="min-h-13 w-48 rounded-2xl border border-orange-100/50 bg-[linear-gradient(180deg,#fed7aa_0%,#fb923c_100%)] px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_16px_40px_rgba(251,146,60,0.22),inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <span aria-live="polite" className="inline-block w-full text-center">
            {buttonLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={onPackageData}
          disabled={!canGenerate}
          className="min-h-13 rounded-2xl border border-cyan-300/45 bg-slate-950/35 px-5 py-3 text-sm font-bold text-cyan-50 transition hover:-translate-y-0.5 hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          Package Data for Github Copilot
        </button>
      </div>
    </div>
  );
}
