import type { ChangeEvent } from "react";

import type { ReviewFinding } from "@/lib/types";

interface FindingCardProps {
  finding: ReviewFinding;
  onToggleApproved: (id: string, approved: boolean) => void;
  onCommentChange: (id: string, text: string) => void;
}

const severityStyles = {
  High: "border-rose-400/60 bg-rose-500/15 text-rose-50",
  Medium: "border-amber-400/60 bg-amber-500/15 text-amber-50",
  Low: "border-cyan-400/60 bg-cyan-500/15 text-cyan-50",
} as const;

export function FindingCard({
  finding,
  onToggleApproved,
  onCommentChange,
}: FindingCardProps) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
            <span
              className={`rounded-full border px-3 py-1 ${severityStyles[finding.severity]}`}
            >
              {finding.severity} Severity
            </span>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-slate-100">
              {finding.category}
            </span>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-slate-100">
              {finding.filePath ?? "General comment"}
              {finding.lineStart ? `:${finding.lineStart}` : ""}
            </span>
          </div>
          <label className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-50 lg:self-start">
            <input
              type="checkbox"
              checked={finding.approved}
              onChange={(event) =>
                onToggleApproved(finding.id, event.target.checked)
              }
              className="h-4 w-4 rounded border-white/20 bg-slate-950"
            />
            Approve for posting
          </label>
        </div>

        <textarea
          value={finding.commentText}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            onCommentChange(finding.id, event.target.value)
          }
          rows={4}
          className="block w-full rounded-2xl border border-white/12 bg-slate-950/70 p-3 text-sm leading-6 text-white outline-none focus:border-cyan-300"
        />
      </div>

      {finding.codeSnippet ? (
        <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs leading-6 text-cyan-100">
          {finding.codeSnippet}
        </pre>
      ) : null}

      <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-100">
          Reviewer rationale
        </summary>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          {finding.rationale}
        </p>
      </details>
    </article>
  );
}
