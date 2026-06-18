import type { JiraTicketOption } from "@/lib/types";

interface TicketSelectorProps {
  tickets: JiraTicketOption[];
  selectedKey: string;
  loading: boolean;
  onSelectTicket: (key: string) => void;
  onRefresh: () => void;
}

export function TicketSelector({
  tickets,
  selectedKey,
  loading,
  onSelectTicket,
  onRefresh,
}: TicketSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <select
          value={selectedKey}
          onChange={(event) => onSelectTicket(event.target.value)}
          disabled={loading || tickets.length === 0}
          className="min-h-12 flex-1 rounded-2xl border border-white/15 bg-slate-950/60 px-4 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30 disabled:opacity-60"
        >
          <option value="">
            {loading
              ? "Loading assigned or developer tickets..."
              : "Select an assigned or developer ticket"}
          </option>
          {tickets.map((ticket) => (
            <option key={ticket.key} value={ticket.key}>
              {ticket.key} - {ticket.summary}
              {ticket.sprint ? ` (${ticket.sprint.name})` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-2xl border border-cyan-300/50 bg-slate-950/25 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-slate-950/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh Tickets"}
        </button>
      </div>

      {selectedKey ? null : (
        <div className="rounded-2xl border border-dashed border-white/20 bg-slate-950/25 p-4 text-sm text-slate-200">
          Assigned or developer tickets will appear here when Jira is
          configured.
        </div>
      )}
    </div>
  );
}
