import type { MergeRequestComment } from "@/lib/types";

interface MergeRequestCommentsPanelProps {
  comments: MergeRequestComment[];
  onToggleComment: (id: string, selected: boolean) => void;
}

function formatCommentLocation(comment: MergeRequestComment) {
  if (comment.filePath && comment.lineNumber) {
    return `${comment.filePath}:${comment.lineNumber}`;
  }

  if (comment.filePath) {
    return comment.filePath;
  }

  return "Merge request level comment";
}

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "Unknown date";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function MergeRequestCommentsPanel({
  comments,
  onToggleComment,
}: MergeRequestCommentsPanelProps) {
  if (comments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/35 px-4 py-6 text-sm text-slate-100">
        No merge request comments were found for this merge request.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <article
          key={comment.id}
          className="rounded-3xl border border-white/12 bg-slate-950/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
                  {comment.author}
                </span>
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-slate-200">
                  {formatCreatedAt(comment.createdAt)}
                </span>
                {comment.resolved ? (
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
                    Resolved
                  </span>
                ) : null}
              </div>
              <p className="wrap-break-word text-sm font-semibold text-emerald-100">
                {formatCommentLocation(comment)}
              </p>
            </div>

            <label className="flex shrink-0 cursor-pointer items-center gap-3 rounded-2xl border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/12">
              <input
                type="checkbox"
                checked={comment.selected}
                onChange={(event) =>
                  onToggleComment(comment.id, event.target.checked)
                }
                className="h-4 w-4 rounded border-white/20 bg-slate-950 text-emerald-300 accent-emerald-300"
              />
              Submit this Comment
            </label>
          </div>

          <p className="mt-4 whitespace-pre-wrap wrap-break-word rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3 text-sm leading-6 text-slate-100">
            {comment.body}
          </p>
        </article>
      ))}
    </div>
  );
}
