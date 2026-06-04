import type { JiraCandidate, JiraIssue } from "@/lib/types";

interface JiraPanelProps {
  candidates: JiraCandidate[];
  jiraIssue: JiraIssue | null;
  selectedKey: string;
  onSelectKey: (key: string) => void;
  onResolve: () => void;
  loading: boolean;
}

export function JiraPanel({
  candidates,
  jiraIssue,
  selectedKey,
  onSelectKey,
  onResolve,
  loading,
}: JiraPanelProps) {
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
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-100">
            {jiraIssue.description}
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
