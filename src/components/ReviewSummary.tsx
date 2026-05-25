import type { ReviewSummary as ReviewSummaryType } from "@/lib/types";

interface ReviewSummaryProps {
  summary: ReviewSummaryType;
}

export function ReviewSummary({ summary }: ReviewSummaryProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
          Assessment
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-50">{summary.overview}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
          Key Concerns
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-100">
          {summary.keyConcerns.map((item, index) => (
            <li key={`concern-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
          Testing Focus
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-100">
          {summary.testingFocus.map((item, index) => (
            <li key={`testing-focus-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
