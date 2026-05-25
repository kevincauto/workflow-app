"use client";

import { useMemo, useState } from "react";

import type { OpenMergeRequestOption } from "@/lib/types";

interface MrUrlFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  openMergeRequests: OpenMergeRequestOption[];
  selectedOpenMr: string;
  onSelectOpenMr: (value: string) => void;
  onRefreshOpenMrs: () => void;
  loadingOpenMrs: boolean;
}

export function MrUrlForm({
  value,
  onChange,
  onSubmit,
  loading,
  openMergeRequests,
  selectedOpenMr,
  onSelectOpenMr,
  onRefreshOpenMrs,
  loadingOpenMrs,
}: MrUrlFormProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const selectedMergeRequest = useMemo(
    () =>
      openMergeRequests.find(
        (mergeRequest) => mergeRequest.webUrl === selectedOpenMr,
      ) ?? null,
    [openMergeRequests, selectedOpenMr],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-white/12 bg-slate-950/50 p-4">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            {/* <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
              Open Merge Requests
            </p> */}
            <p className="mt-1 text-sm text-slate-100">Open Merge Requests</p>
          </div>
          <button
            type="button"
            onClick={onRefreshOpenMrs}
            disabled={loadingOpenMrs}
            className="min-h-11 rounded-2xl border border-white/20 bg-slate-950/35 px-4 py-2.5 text-sm font-semibold text-slate-50 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingOpenMrs ? "Refreshing..." : "Refresh open MRs"}
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPickerOpen((current) => !current)}
            className="min-h-14 w-full rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,23,42,0.66))] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition hover:border-cyan-200/40 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
            aria-expanded={isPickerOpen}
            aria-haspopup="listbox"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
                  {selectedMergeRequest
                    ? "Selected Merge Request"
                    : "Open Merge Requests"}
                </p>
                {selectedMergeRequest ? (
                  <div className="mt-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      !{selectedMergeRequest.iid} {selectedMergeRequest.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-200">
                      {selectedMergeRequest.sourceBranch} to{" "}
                      {selectedMergeRequest.targetBranch} by{" "}
                      {selectedMergeRequest.author}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-100">
                    Select an open merge request
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-slate-950/30 text-cyan-50">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className={
                    isPickerOpen ? "rotate-180 transition" : "transition"
                  }
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </button>

          {isPickerOpen ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 overflow-hidden rounded-3xl border border-white/12 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))] shadow-[0_24px_90px_rgba(2,6,23,0.65)] backdrop-blur-xl">
              <div className="border-b border-white/8 px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-300">
                {openMergeRequests.length} open merge requests
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {openMergeRequests.length > 0 ? (
                  openMergeRequests.map((mergeRequest) => {
                    const isSelected = mergeRequest.webUrl === selectedOpenMr;

                    return (
                      <button
                        key={mergeRequest.iid}
                        type="button"
                        onClick={() => {
                          onSelectOpenMr(mergeRequest.webUrl);
                          setIsPickerOpen(false);
                        }}
                        className={`mb-2 w-full rounded-2xl border px-4 py-3 text-left transition last:mb-0 ${
                          isSelected
                            ? "border-cyan-300/35 bg-cyan-300/10"
                            : "border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/8"
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              !{mergeRequest.iid} {mergeRequest.title}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-200">
                              {mergeRequest.sourceBranch} to{" "}
                              {mergeRequest.targetBranch}
                            </p>
                          </div>
                          {isSelected ? (
                            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                              Selected
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-slate-300">
                          {mergeRequest.author}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-200">
                    No open merge requests were returned for the configured
                    project.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {isPickerOpen ? (
            <button
              type="button"
              aria-label="Close merge request picker"
              onClick={() => setIsPickerOpen(false)}
              className="fixed inset-0 z-20 cursor-default"
            />
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-[0.24em] text-slate-300">
          or
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <div className="flex flex-col gap-4 md:flex-row">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://gitlab.example.com/group/project/-/merge_requests/123"
          className="min-h-13 flex-1 rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="min-h-13 rounded-2xl border border-cyan-100/50 bg-[linear-gradient(180deg,#a5f3fc_0%,#22d3ee_100%)] px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(34,211,238,0.36),inset_0_1px_0_rgba(255,255,255,0.75)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading ? "Loading Merge Request..." : "Load Merge Request"}
        </button>
      </div>
    </div>
  );
}
