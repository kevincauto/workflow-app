import type { PostResult } from "@/lib/types";

interface PostResultsPanelProps {
  results: PostResult[];
  onPost: () => void;
  loading: boolean;
  approvedCount: number;
}

export function PostResultsPanel({
  results,
  onPost,
  loading,
  approvedCount,
}: PostResultsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-100">
          {approvedCount} approved comments ready to post. Inline posting is
          attempted first, with fallback to general MR notes when needed.
        </p>
        <button
          type="button"
          onClick={onPost}
          disabled={loading || approvedCount === 0}
          className="min-h-13 rounded-2xl border border-cyan-100/50 bg-[linear-gradient(180deg,#a5f3fc_0%,#22d3ee_100%)] px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(34,211,238,0.36),inset_0_1px_0_rgba(255,255,255,0.75)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading ? "Posting Comments..." : "Post Approved Comments"}
        </button>
      </div>

      {results.length > 0 ? (
        <div className="space-y-3">
          {results.map((result) => (
            <div
              key={result.findingId}
              className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-100"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14em] text-slate-200">
                  {result.status}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14em] text-slate-200">
                  {result.mode}
                </span>
                <span className="text-xs text-slate-400">
                  {result.findingId}
                </span>
              </div>
              <p className="mt-2 leading-6 text-slate-100">{result.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
