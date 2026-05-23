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
        <p className="text-sm text-slate-200">
          Generate 3 to 10 high-value findings using the loaded merge request,
          Jira context, diff hunks, changed file contents, and bounded
          related-file retrieval.
        </p>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={loading || !canGenerate}
        className="min-h-13 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Generating review..." : "Generate review"}
      </button>
    </div>
  );
}
