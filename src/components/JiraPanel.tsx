import { useEffect, useRef } from "react";

import type { JiraCandidate, JiraIssue } from "@/lib/types";

interface JiraPanelProps {
  candidates: JiraCandidate[];
  jiraIssue: JiraIssue | null;
  selectedKey: string;
  onSelectKey: (key: string) => void;
  onDescriptionChange: (description: string) => void;
  onResolve: () => void;
  loading: boolean;
}

export function JiraPanel({
  candidates,
  jiraIssue,
  selectedKey,
  onSelectKey,
  onDescriptionChange,
  onResolve,
  loading,
}: JiraPanelProps) {
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  function resizeDescriptionTextarea(textarea: HTMLTextAreaElement) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  useEffect(() => {
    if (descriptionTextareaRef.current) {
      resizeDescriptionTextarea(descriptionTextareaRef.current);
    }
  }, [jiraIssue?.description]);

  return (
    <div className="space-y-4">
      {candidates.length > 1 ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <select
            value={selectedKey}
            onChange={(event) => onSelectKey(event.target.value)}
            className="min-h-12 flex-1 rounded-2xl border border-white/15 bg-slate-950/60 px-4 text-sm text-white outline-none"
          >
            {candidates.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {candidate.key} from {candidate.source}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onResolve}
            disabled={loading || !selectedKey}
            className="rounded-2xl border border-cyan-300/50 bg-slate-950/25 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-slate-950/40 disabled:opacity-50"
          >
            {loading ? "Loading Jira..." : "Load Jira Context"}
          </button>
        </div>
      ) : null}

      {jiraIssue ? (
        <div className="rounded-2xl border border-emerald-300/25 bg-slate-950/45 p-4">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
              {jiraIssue.key}
            </p>
            <a
              href={jiraIssue.webUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-emerald-100 transition hover:border-emerald-200/60 hover:bg-emerald-300/20 focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
              aria-label={`Open Jira ticket ${jiraIssue.key}`}
              title="Open Jira ticket"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
              >
                <path
                  d="M8.5 5.5H5.75A1.75 1.75 0 0 0 4 7.25v7A1.75 1.75 0 0 0 5.75 16h7a1.75 1.75 0 0 0 1.75-1.75V11.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M11 4h5v5M9 11l6.5-6.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-50">
            {jiraIssue.summary}
          </h3>
          <label className="mt-4 block text-xs uppercase tracking-[0.18em] text-orange-300">
            Editable Ticket Description
          </label>
          <textarea
            ref={descriptionTextareaRef}
            value={jiraIssue.description}
            onChange={(event) => {
              resizeDescriptionTextarea(event.currentTarget);
              onDescriptionChange(event.currentTarget.value);
            }}
            rows={1}
            className="mt-2 min-h-48 w-full resize-y overflow-hidden rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
            placeholder="Add Jira context, acceptance criteria, or meeting notes for the AI review."
          />
          <p className="mt-2 text-xs leading-5 text-slate-300">
            Edits here are included in the JSON payload sent to the AI review
            endpoint.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/20 bg-slate-950/25 p-4 text-sm text-slate-200">
          {candidates.length === 0
            ? "No Jira ticket detected. Review generation will continue without Jira acceptance criteria context."
            : "Choose a Jira key to load ticket context before generating the review."}
        </div>
      )}
    </div>
  );
}
