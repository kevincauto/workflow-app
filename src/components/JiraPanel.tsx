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
          <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
            {jiraIssue.key}
          </p>
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
