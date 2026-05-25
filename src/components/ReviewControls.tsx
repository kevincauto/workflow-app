interface ReviewControlsProps {
  onGenerate: () => void;
  loading: boolean;
  canGenerate: boolean;
}

export function ReviewControls({
  onGenerate,
  loading,
  canGenerate,
}: ReviewControlsProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm text-slate-100">
          Generate 3 to 10 high-value findings using the loaded merge request,
          Jira context, diff hunks, changed file contents, and bounded
          related-file retrieval.
        </p>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={loading || !canGenerate}
        className="min-h-13 rounded-2xl border border-cyan-100/50 bg-[linear-gradient(180deg,#a5f3fc_0%,#22d3ee_100%)] px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(34,211,238,0.36),inset_0_1px_0_rgba(255,255,255,0.75)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {loading ? "Generating Review..." : "Generate Review"}
      </button>
    </div>
  );
}
