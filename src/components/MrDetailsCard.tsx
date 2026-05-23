import type { MergeRequestContext } from "@/lib/types";

interface MrDetailsCardProps {
  mergeRequest: MergeRequestContext;
}

export function MrDetailsCard({ mergeRequest }: MrDetailsCardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 md:col-span-6">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
          Title
        </p>
        <p className="mt-2 text-base font-medium text-white">
          {mergeRequest.title}
        </p>
      </div>

      <div className="grid gap-4 md:col-span-6 md:grid-cols-6">
        <div className="min-h-[116px] rounded-2xl border border-cyan-300/15 bg-slate-950/35 p-4 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Source Branch
          </p>
          <p className="mt-2 break-all text-sm font-medium text-white">
            {mergeRequest.sourceBranch}
          </p>
        </div>

        <div className="flex min-h-[116px] items-center justify-center rounded-2xl border border-white/8 bg-white/4 p-4 md:col-span-2">
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

        <div className="min-h-[116px] rounded-2xl border border-emerald-300/15 bg-slate-950/35 p-4 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Target Branch
          </p>
          <p className="mt-2 break-all text-sm font-medium text-white">
            {mergeRequest.targetBranch}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 md:col-span-4">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
          Project
        </p>
        <p className="mt-2 text-sm text-white">{mergeRequest.projectPath}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 md:col-span-2">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
          Changed Files
        </p>
        <p className="mt-2 text-sm text-white">
          {mergeRequest.changedFiles.length}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 md:col-span-6">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
          Description
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
          {mergeRequest.description || "No merge request description provided."}
        </p>
      </div>
    </div>
  );
}
