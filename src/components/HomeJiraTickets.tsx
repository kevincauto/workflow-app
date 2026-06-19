"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  JiraTicketOption,
  ListAssignedJiraTicketsResponse,
} from "@/lib/types";

const sprintStatusLabels = [
  "TO DO",
  "IN DEV",
  "DEV REVIEW",
  "READY FOR ACCEPTANCE",
  "DONE",
] as const;

type SprintStatusLabel = (typeof sprintStatusLabels)[number] | "BACKLOG";
type BoardStatusLabel = (typeof sprintStatusLabels)[number];

const statusBadgeStyles: Record<SprintStatusLabel, string> = {
  "TO DO": "border-slate-300/25 bg-slate-300/10 text-slate-100",
  "IN DEV": "border-cyan-300/30 bg-cyan-300/12 text-cyan-100",
  "DEV REVIEW": "border-violet-300/30 bg-violet-300/12 text-violet-100",
  "READY FOR ACCEPTANCE": "border-amber-300/35 bg-amber-300/12 text-amber-100",
  DONE: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
  BACKLOG: "border-white/15 bg-white/8 text-slate-200",
};

const statusAliases: Record<string, BoardStatusLabel> = {
  BACKLOG: "TO DO",
  "READY FOR DEV": "TO DO",
  "READY FOR DEVELOPMENT": "TO DO",
  "SELECTED FOR DEVELOPMENT": "TO DO",
  "IN DEVELOPMENT": "IN DEV",
  "IN PROGRESS": "IN DEV",
  "CODE REVIEW": "DEV REVIEW",
  "IN CODE REVIEW": "DEV REVIEW",
  REVIEW: "DEV REVIEW",
  ACCEPTANCE: "READY FOR ACCEPTANCE",
  "READY FOR QA": "READY FOR ACCEPTANCE",
  "READY FOR UAT": "READY FOR ACCEPTANCE",
};

async function getAssignedTickets(): Promise<ListAssignedJiraTicketsResponse> {
  const response = await fetch("/api/jira/assigned", { cache: "no-store" });
  const data = (await response.json()) as ListAssignedJiraTicketsResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Jira tickets.");
  }

  return data;
}

function normalizeStatus(value: string | null) {
  return (value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getTicketBadgeLabel(ticket: JiraTicketOption): SprintStatusLabel {
  if (ticket.sprint?.state === "future") {
    return "BACKLOG";
  }

  const normalizedStatus = normalizeStatus(ticket.status);

  if (statusAliases[normalizedStatus]) {
    return statusAliases[normalizedStatus];
  }

  if (sprintStatusLabels.includes(normalizedStatus as BoardStatusLabel)) {
    return normalizedStatus as BoardStatusLabel;
  }

  return "BACKLOG";
}

function getTicketDetail(ticket: JiraTicketOption) {
  const details = [
    ticket.issueType,
    ticket.priority,
    ticket.estimatePoints !== null ? `${ticket.estimatePoints} pts` : null,
    ticket.sprint?.name,
    ticket.assignee ? `Assignee: ${ticket.assignee}` : null,
  ].filter(Boolean);

  return details.length ? details.join(" · ") : "Jira details unavailable";
}

export function HomeJiraTickets() {
  const [tickets, setTickets] = useState<JiraTicketOption[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentSprintTickets = useMemo(
    () => tickets.filter((ticket) => ticket.sprint?.state === "active").length,
    [tickets],
  );
  const backlogTickets = tickets.length - currentSprintTickets;
  const estimatedPoints = useMemo(
    () =>
      tickets.reduce(
        (total, ticket) => total + (ticket.estimatePoints ?? 0),
        0,
      ),
    [tickets],
  );

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getAssignedTickets();
      setTickets(response.tickets);
      setNotices(response.notices);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load Jira tickets.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTickets();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTickets]);

  return (
    <section aria-labelledby="jira-ticket-list-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="jira-ticket-list-title"
            className="text-xl font-semibold text-white"
          >
            Jira Tickets
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Current sprint work and upcoming sprint tickets assigned to you.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTickets}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-slate-950/45 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-200/35 hover:bg-slate-950/65 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh Tickets"}
        </button>
      </div>

      <div className="rounded-lg border border-white/12 bg-slate-950/58 shadow-[0_22px_70px_rgba(2,6,23,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
        <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-4">
          <div>
            <p className="text-2xl font-semibold text-white">
              {loading ? "-" : tickets.length}
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
              Total
            </p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-white">
              {loading ? "-" : currentSprintTickets}
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
              Current Sprint
            </p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-white">
              {loading ? "-" : backlogTickets}
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
              Backlog
            </p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-white">
              {loading ? "-" : estimatedPoints}
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
              Points
            </p>
          </div>
        </div>

        {error ? (
          <div className="m-4 rounded-lg border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {notices.length > 0 ? (
          <div className="space-y-2 border-b border-white/10 px-4 py-3">
            {notices.map((notice, index) => (
              <p
                key={`home-jira-notice-${index}`}
                className="text-sm text-slate-300"
              >
                {notice}
              </p>
            ))}
          </div>
        ) : null}

        <div className="divide-y divide-white/8">
          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-300">
              Loading Jira tickets...
            </div>
          ) : tickets.length > 0 ? (
            tickets.map((ticket) => {
              const badgeLabel = getTicketBadgeLabel(ticket);

              return (
                <article
                  key={ticket.key}
                  className="flex flex-col gap-3 px-4 py-4 transition hover:bg-white/5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/ticket-to-code?ticket=${encodeURIComponent(ticket.key)}`}
                        className="text-sm font-semibold text-cyan-100 transition hover:text-white"
                      >
                        {ticket.key}
                      </a>
                      <span className="text-xs text-slate-500">/</span>
                      <p className="min-w-0 text-sm font-medium text-white sm:truncate">
                        {ticket.summary}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      {getTicketDetail(ticket)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <span className="inline-flex min-h-8 items-center justify-center rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold text-slate-100">
                      {ticket.estimatePoints !== null
                        ? `${ticket.estimatePoints} pts`
                        : "No pts"}
                    </span>
                    <span
                      className={`inline-flex min-h-8 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${statusBadgeStyles[badgeLabel]}`}
                    >
                      {badgeLabel}
                    </span>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="px-4 py-6 text-sm text-slate-300">
              No current or future Jira tickets were returned.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
