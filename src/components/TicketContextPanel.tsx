import { Copy, ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";

import type { JiraTicketOption } from "@/lib/types";

interface TicketContextPanelProps {
  ticket: JiraTicketOption | null;
  description: string;
  onDescriptionChange: (description: string) => void;
}

export function TicketContextPanel({
  ticket,
  description,
  onDescriptionChange,
}: TicketContextPanelProps) {
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  function resizeDescriptionTextarea(textarea: HTMLTextAreaElement) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  useEffect(() => {
    if (descriptionTextareaRef.current) {
      resizeDescriptionTextarea(descriptionTextareaRef.current);
    }
  }, [description]);

  async function copyTicketKey() {
    if (!ticket) {
      return;
    }

    await navigator.clipboard.writeText(ticket.key);
  }

  if (!ticket) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-200/35 bg-white/[0.07] p-4 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        Choose a ticket to load editable requirements.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/20 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200">
            Key
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-base font-semibold text-slate-50">
              {ticket.key}
            </p>
            <a
              href={ticket.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-amber-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300"
              aria-label={`Open ${ticket.key} in Jira`}
              title="Open in Jira"
            >
              <ExternalLink aria-hidden="true" size={16} />
            </a>
            <button
              type="button"
              onClick={() => void copyTicketKey()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-amber-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300"
              aria-label={`Copy Jira key ${ticket.key}`}
              title="Copy Jira key"
            >
              <Copy aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200">
            Status
          </p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {ticket.status ?? "Unknown"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200">
            Priority
          </p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {ticket.priority ?? "Unknown"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200">
            Sprint
          </p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {ticket.sprint?.name ?? "Unknown"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/20 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200">
            Assignee
          </p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {ticket.assignee ?? "Unknown"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200">
            Developer
          </p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {ticket.developer ?? "Unknown"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200/30 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <p className="text-xs uppercase tracking-[0.18em] text-amber-200">
          {ticket.issueType ?? "Ticket"}
        </p>
        <h3 className="mt-2 text-base font-semibold text-slate-50">
          {ticket.summary}
        </h3>
        <label className="mt-4 block text-xs uppercase tracking-[0.18em] text-amber-200">
          Editable Ticket Description
        </label>
        <textarea
          ref={descriptionTextareaRef}
          value={description}
          onChange={(event) => {
            resizeDescriptionTextarea(event.currentTarget);
            onDescriptionChange(event.currentTarget.value);
          }}
          rows={1}
          className="mt-2 min-h-56 w-full resize-y overflow-hidden rounded-xl border border-amber-200/25 bg-[#07111f] px-4 py-3 text-sm leading-6 text-slate-100 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
          placeholder="Add requirements, acceptance criteria, and meeting notes."
        />
      </div>
    </div>
  );
}
