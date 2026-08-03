import { Copy, ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";

import {
  TicketImagesPanel,
  type UploadedTicketImage,
} from "@/components/TicketImagesPanel";
import type { JiraTicketOption } from "@/lib/types";

interface TicketContextPanelProps {
  ticket: JiraTicketOption | null;
  description: string;
  onDescriptionChange: (description: string) => void;
  uploadedImages: UploadedTicketImage[];
  excludedJiraImageIds: Set<string>;
  onAddImageFiles: (files: File[]) => void;
  onExcludeJiraImage: (attachmentId: string) => void;
  onRemoveUploadedImage: (imageId: string) => void;
}

export function TicketContextPanel({
  ticket,
  description,
  onDescriptionChange,
  uploadedImages,
  excludedJiraImageIds,
  onAddImageFiles,
  onExcludeJiraImage,
  onRemoveUploadedImage,
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
      <div className="rounded-2xl border border-dashed border-white/20 bg-slate-950/25 p-4 text-sm text-slate-200">
        Choose a ticket to load editable requirements.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-cyan-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              aria-label={`Open ${ticket.key} in Jira`}
              title="Open in Jira"
            >
              <ExternalLink aria-hidden="true" size={16} />
            </a>
            <button
              type="button"
              onClick={() => void copyTicketKey()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-cyan-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              aria-label={`Copy Jira key ${ticket.key}`}
              title="Copy Jira key"
            >
              <Copy aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
            Status
          </p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {ticket.status ?? "Unknown"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
            Priority
          </p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {ticket.priority ?? "Unknown"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
            Sprint
          </p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {ticket.sprint?.name ?? "Unknown"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
            Assignee
          </p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {ticket.assignee ?? "Unknown"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
            Developer
          </p>
          <p className="mt-2 text-base font-semibold text-slate-50">
            {ticket.developer ?? "Unknown"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-300/25 bg-slate-950/45 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
          {ticket.issueType ?? "Ticket"}
        </p>
        <h3 className="mt-2 text-base font-semibold text-slate-50">
          {ticket.summary}
        </h3>
        <label className="mt-4 block text-xs uppercase tracking-[0.18em] text-orange-300">
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
          className="mt-2 min-h-56 w-full resize-y overflow-hidden rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
          placeholder="Add requirements, acceptance criteria, and meeting notes."
        />
      </div>

      <TicketImagesPanel
        ticketKey={ticket.key}
        jiraImages={(ticket.imageAttachments ?? []).filter(
          (image) => !excludedJiraImageIds.has(image.id),
        )}
        uploadedImages={uploadedImages}
        onAddFiles={onAddImageFiles}
        onExcludeJiraImage={onExcludeJiraImage}
        onRemoveUploadedImage={onRemoveUploadedImage}
      />
    </div>
  );
}
