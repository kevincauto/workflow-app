"use client";

import { useMemo, useState } from "react";

import type { JiraTicketOption } from "@/lib/types";

interface TicketSelectorProps {
  tickets: JiraTicketOption[];
  selectedKey: string;
  loading: boolean;
  urlLoading: boolean;
  urlError: string | null;
  onSelectTicket: (key: string) => void;
  onRefresh: () => void;
  onLoadFromUrl: (url: string) => void;
}

export function TicketSelector({
  tickets,
  selectedKey,
  loading,
  urlLoading,
  urlError,
  onSelectTicket,
  onRefresh,
  onLoadFromUrl,
}: TicketSelectorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [ticketFilter, setTicketFilter] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.key === selectedKey) ?? null,
    [selectedKey, tickets],
  );

  const filteredTickets = useMemo(() => {
    const normalizedFilter = ticketFilter.trim().toLowerCase();

    if (!normalizedFilter) {
      return tickets;
    }

    return tickets.filter((ticket) => {
      const searchableText = [
        ticket.key,
        ticket.summary,
        ticket.status,
        ticket.priority,
        ticket.assignee,
        ticket.developer,
        ticket.sprint?.name,
      ]
        .filter(Boolean)
        .join(" ");

      return searchableText.toLowerCase().includes(normalizedFilter);
    });
  }, [ticketFilter, tickets]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-300/20 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="mb-3">
          <p className="text-xs uppercase tracking-[0.18em] text-blue-300">
            Assigned Or Developer Tickets
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-3">
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => setIsPickerOpen((current) => !current)}
              disabled={loading || tickets.length === 0}
              className="min-h-14 w-full rounded-lg border border-blue-300/25 bg-[#07111f] px-4 py-3 text-left shadow-[0_8px_24px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition hover:border-blue-300/55 hover:bg-[#0b192b] focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-60"
              aria-expanded={isPickerOpen}
              aria-haspopup="listbox"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-300">
                    {selectedTicket ? "Selected Ticket" : "Jira Tickets"}
                  </p>
                  {selectedTicket ? (
                    <div className="mt-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {selectedTicket.key} - {selectedTicket.summary}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-200">
                        {selectedTicket.status ?? "Status unknown"}
                        {selectedTicket.sprint
                          ? ` in ${selectedTicket.sprint.name}`
                          : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-100">
                      {loading
                        ? "Loading assigned or developer tickets..."
                        : "Select an assigned or developer ticket"}
                    </p>
                  )}
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-300/25 bg-blue-400/10 text-blue-100">
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
              <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-50 overflow-hidden rounded-lg border border-blue-300/35 bg-[#050b14] shadow-[0_24px_90px_rgba(2,6,23,0.8)]">
                <div className="space-y-3 border-b border-white/8 px-4 py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs uppercase tracking-[0.18em] text-blue-300">
                      {filteredTickets.length} of {tickets.length} tickets
                    </p>
                    {ticketFilter ? (
                      <button
                        type="button"
                        onClick={() => setTicketFilter("")}
                        className="text-left text-xs font-semibold text-blue-200 transition hover:text-white sm:text-right"
                      >
                        Clear filter
                      </button>
                    ) : null}
                  </div>
                  <input
                    value={ticketFilter}
                    onChange={(event) => setTicketFilter(event.target.value)}
                    placeholder="Filter by key, summary, sprint, or assignee"
                    className="min-h-11 w-full rounded-lg border border-blue-300/25 bg-[#101c2e] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
                    autoFocus
                  />
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {filteredTickets.length > 0 ? (
                    filteredTickets.map((ticket) => {
                      const isSelected = ticket.key === selectedKey;

                      return (
                        <button
                          key={ticket.key}
                          type="button"
                          onClick={() => {
                            onSelectTicket(ticket.key);
                            setIsPickerOpen(false);
                          }}
                          className={`mb-2 w-full rounded-lg border px-4 py-3 text-left transition last:mb-0 ${
                            isSelected
                              ? "border-blue-400/35 bg-blue-400/10"
                              : "border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/8"
                          }`}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {ticket.key} - {ticket.summary}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-200">
                                {ticket.status ?? "Status unknown"}
                                {ticket.priority ? ` · ${ticket.priority}` : ""}
                                {ticket.sprint
                                  ? ` · ${ticket.sprint.name}`
                                  : ""}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200">
                                Selected
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 truncate text-xs text-slate-300">
                            Assignee: {ticket.assignee ?? "Unknown"} ·
                            Developer: {ticket.developer ?? "Unknown"}
                          </p>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-slate-200">
                      {tickets.length === 0
                        ? "No assigned or developer tickets were returned from Jira."
                        : "No tickets match that filter."}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {isPickerOpen ? (
              <button
                type="button"
                aria-label="Close ticket picker"
                onClick={() => setIsPickerOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
            ) : null}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex w-36 self-stretch items-center justify-center rounded-lg border border-blue-300/25 bg-[#07111f] px-4 py-2.5 text-sm font-semibold text-blue-100 shadow-[0_8px_24px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-blue-300/55 hover:bg-[#0b192b] focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh Tickets"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-300/20 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="mb-3">
          <p className="text-xs uppercase tracking-[0.18em] text-blue-300">
            Load Ticket By URL
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Paste a Jira ticket URL or key to pull a ticket that is not in the
            list above.
          </p>
        </div>

        <form
          className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedUrl = ticketUrl.trim();

            if (trimmedUrl) {
              onLoadFromUrl(trimmedUrl);
            }
          }}
        >
          <input
            value={ticketUrl}
            onChange={(event) => setTicketUrl(event.target.value)}
            placeholder="https://jira.ftscc.net/browse/ABC-1000"
            aria-label="Jira ticket URL or key"
            className="min-h-14 w-full rounded-lg border border-blue-300/25 bg-[#07111f] px-4 py-3 text-sm text-white shadow-[0_8px_24px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition placeholder:text-slate-500 hover:border-blue-300/55 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
          />
          <button
            type="submit"
            disabled={urlLoading || !ticketUrl.trim()}
            className="inline-flex w-36 self-stretch items-center justify-center rounded-lg border border-blue-300/25 bg-[#07111f] px-4 py-2.5 text-sm font-semibold text-blue-100 shadow-[0_8px_24px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-blue-300/55 hover:bg-[#0b192b] focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {urlLoading ? "Loading..." : "Load Ticket"}
          </button>
        </form>

        {urlError ? (
          <p className="mt-3 text-sm text-amber-200" role="status">
            {urlError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
