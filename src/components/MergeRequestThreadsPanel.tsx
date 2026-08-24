import { groupMergeRequestThreads } from "@/lib/threadResolutionPackage";
import type {
  MergeRequestComment,
  MergeRequestThreadStatus,
} from "@/lib/types";

interface MergeRequestThreadsPanelProps {
  comments: MergeRequestComment[];
}

const statusStyles: Record<MergeRequestThreadStatus, string> = {
  resolved:
    "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  unresolved: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  "not-resolvable": "border-sky-300/25 bg-sky-300/10 text-sky-100",
};

const statusLabels: Record<MergeRequestThreadStatus, string> = {
  resolved: "Resolved in GitLab",
  unresolved: "Unresolved in GitLab",
  "not-resolvable": "General discussion",
};

function formatLocation(filePath: string | null, lineNumber: number | null) {
  if (filePath && lineNumber) {
    return `${filePath}:${lineNumber}`;
  }

  return filePath ?? "Merge request level discussion";
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

export function MergeRequestThreadsPanel({
  comments,
}: MergeRequestThreadsPanelProps) {
  const threads = groupMergeRequestThreads(comments);

  if (threads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/35 px-4 py-6 text-sm text-slate-100">
        No human merge request discussions were found. The exported package can
        still be used for a fresh regression review.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {threads.map((thread, threadIndex) => (
        <article
          key={thread.discussionId}
          className="rounded-3xl border border-white/12 bg-slate-950/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">
                Discussion {threadIndex + 1}
              </p>
              <p className="mt-2 wrap-break-word text-sm font-semibold text-white">
                {formatLocation(thread.filePath, thread.lineNumber)}
              </p>
            </div>
            <span
              className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${statusStyles[thread.status]}`}
            >
              {statusLabels[thread.status]}
            </span>
          </div>

          <div className="mt-4 space-y-3 border-l border-white/15 pl-4">
            {thread.comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="font-semibold text-amber-100">
                    {comment.author}
                  </span>
                  <span>{formatCreatedAt(comment.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-slate-100">
                  {comment.body}
                </p>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
