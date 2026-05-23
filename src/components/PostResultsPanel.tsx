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
        <p className="text-sm text-slate-200">
          {approvedCount} approved comments ready to post. Inline posting is
          attempted first, with fallback to general MR notes when needed.
        </p>
        <button
          type="button"
          onClick={onPost}
          disabled={loading || approvedCount === 0}
          className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Posting comments..." : "Post approved comments"}
        </button>
      </div>

      {results.length > 0 ? (
        <div className="space-y-3">
          {results.map((result) => (
            <div
              key={result.findingId}
              className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-100"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14em] text-slate-300">
                  {result.status}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14em] text-slate-300">
                  {result.mode}
                </span>
                <span className="text-xs text-slate-500">
                  {result.findingId}
                </span>
              </div>
              <p className="mt-2 leading-6 text-slate-200">{result.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
