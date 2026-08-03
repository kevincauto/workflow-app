import type { MergeRequestContext } from "@/lib/types";

interface MrDetailsCardProps {
  mergeRequest: MergeRequestContext;
}

export function MrDetailsCard({ mergeRequest }: MrDetailsCardProps) {
  async function copySourceBranch() {
    await navigator.clipboard.writeText(mergeRequest.sourceBranch);
  }

  return (
    <div className="grid gap-4 md:grid-cols-6">
      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 md:col-span-6">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
          Title
        </p>
        <p className="mt-2 text-base font-medium text-slate-50">
          {mergeRequest.title}
        </p>
      </div>

      <div className="grid gap-4 md:col-span-6 md:grid-cols-6">
        <div className="min-h-[116px] rounded-2xl border border-cyan-300/20 bg-slate-950/50 p-4 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
              Source Branch
            </p>
            <button
              type="button"
              onClick={() => void copySourceBranch()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              aria-label={`Copy source branch ${mergeRequest.sourceBranch}`}
              title="Copy source branch"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
              >
                <path
                  d="M7 7.5A1.5 1.5 0 0 1 8.5 6h6A1.5 1.5 0 0 1 16 7.5v6a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 7 13.5v-6Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M4 11.5v-6A1.5 1.5 0 0 1 5.5 4h6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <p className="mt-2 break-all text-sm font-medium text-slate-50">
            {mergeRequest.sourceBranch}
          </p>
        </div>

        <div className="flex min-h-[116px] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/35 p-4 md:col-span-2">
          <svg
            width="112"
            height="20"
            viewBox="0 0 112 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="text-sky-100/90"
          >
            <path
              d="M4 10H104M104 10L95 2M104 10L95 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="min-h-[116px] rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-4 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
            Target Branch
          </p>
          <p className="mt-2 break-all text-sm font-medium text-slate-50">
            {mergeRequest.targetBranch}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 md:col-span-4">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
          Project
        </p>
        <p className="mt-2 text-sm text-slate-50">{mergeRequest.projectPath}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 md:col-span-2">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
          Changed Files
        </p>
        <p className="mt-2 text-sm text-slate-50">
          {mergeRequest.changedFiles.length}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 md:col-span-6">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
          Description
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-100">
          {mergeRequest.description || "No merge request description provided."}
        </p>
      </div>
    </div>
  );
}
