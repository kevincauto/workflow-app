"use client";

import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { strToU8, zipSync } from "fflate";

import {
  AttachedFilesPanel,
  type UploadedTicketAttachment,
} from "@/components/AttachedFilesPanel";
import { FigmaContextPanel } from "@/components/FigmaContextPanel";
import { SectionCard } from "@/components/SectionCard";
import { TicketContextPanel } from "@/components/TicketContextPanel";
import { TicketSelector } from "@/components/TicketSelector";
import {
  buildTicketToCodePackageFiles,
  getTicketToCodePackageFolderName,
} from "@/lib/ticketToCodePackage";
import type {
  FigmaExtractResponse,
  FigmaViewport,
  JiraTicketOption,
  ListAssignedJiraTicketsResponse,
  NormalizedFigmaContext,
  PackageAttachment,
  TicketToCodePackageInput,
} from "@/lib/types";

interface FigmaContextSlot {
  id: string;
  viewport: FigmaViewport;
  url: string;
  figma: NormalizedFigmaContext | null;
  loading: boolean;
  error: string | null;
}

function createFigmaSlot(viewport: FigmaViewport): FigmaContextSlot {
  return {
    id: `figma-${viewport}`,
    viewport,
    url: "",
    figma: null,
    loading: false,
    error: null,
  };
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export function TicketToCodeDashboard() {
  const [tickets, setTickets] = useState<JiraTicketOption[]>([]);
  const [selectedTicketKey, setSelectedTicketKey] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [figmaSlots, setFigmaSlots] = useState<FigmaContextSlot[]>([
    createFigmaSlot("desktop"),
    createFigmaSlot("mobile"),
  ]);
  const [uploadedAttachments, setUploadedAttachments] = useState<
    UploadedTicketAttachment[]
  >([]);
  const [excludedJiraAttachmentIds, setExcludedJiraAttachmentIds] = useState<
    Set<string>
  >(new Set());
  const [jiraAttachmentExplanations, setJiraAttachmentExplanations] = useState<
    Record<string, string>
  >({});
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [downloadingPackage, setDownloadingPackage] = useState(false);
  const selectedTicketKeyRef = useRef("");
  const uploadedAttachmentsRef = useRef<UploadedTicketAttachment[]>([]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.key === selectedTicketKey) ?? null,
    [selectedTicketKey, tickets],
  );

  const clearTicketAttachments = useCallback(() => {
    for (const attachment of uploadedAttachmentsRef.current) {
      URL.revokeObjectURL(attachment.previewUrl);
    }

    uploadedAttachmentsRef.current = [];
    setUploadedAttachments([]);
    setExcludedJiraAttachmentIds(new Set());
    setJiraAttachmentExplanations({});
  }, []);

  const loadTickets = useCallback(async () => {
    setError(null);
    setLoadingTickets(true);

    try {
      const response =
        await getJson<ListAssignedJiraTicketsResponse>("/api/jira/assigned");
      setTickets(response.tickets);
      setNotices(response.notices);

      if (
        selectedTicketKeyRef.current &&
        !response.tickets.some(
          (ticket) => ticket.key === selectedTicketKeyRef.current,
        )
      ) {
        selectedTicketKeyRef.current = "";
        setSelectedTicketKey("");
        setEditedDescription("");
        clearTicketAttachments();
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load assigned or developer tickets.",
      );
    } finally {
      setLoadingTickets(false);
    }
  }, [clearTicketAttachments]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTickets();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTickets]);

  useEffect(
    () => () => {
      for (const attachment of uploadedAttachmentsRef.current) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    },
    [],
  );

  function handleSelectTicket(key: string) {
    const ticket = tickets.find((candidate) => candidate.key === key) ?? null;

    selectedTicketKeyRef.current = key;
    setSelectedTicketKey(key);
    setEditedDescription(ticket?.description ?? "");
    clearTicketAttachments();
  }

  function handleAddAttachmentFiles(files: File[]) {
    setUploadedAttachments((current) => {
      const signatures = new Set(
        current.map(
          (image) =>
            `${image.file.name}:${image.file.size}:${image.file.lastModified}:${image.file.type}`,
        ),
      );
      const additions = files.flatMap((file) => {
        const signature = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;

        if (signatures.has(signature)) {
          return [];
        }

        signatures.add(signature);
        return [
          {
            id: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(file),
            explanation: "",
          },
        ];
      });
      const next = [...current, ...additions];
      uploadedAttachmentsRef.current = next;
      return next;
    });
  }

  function handleRemoveUploadedAttachment(attachmentId: string) {
    setUploadedAttachments((current) => {
      const removed = current.find(
        (attachment) => attachment.id === attachmentId,
      );
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      const next = current.filter(
        (attachment) => attachment.id !== attachmentId,
      );
      uploadedAttachmentsRef.current = next;
      return next;
    });
  }

  function updateUploadedAttachmentExplanation(
    attachmentId: string,
    explanation: string,
  ) {
    setUploadedAttachments((current) => {
      const next = current.map((attachment) =>
        attachment.id === attachmentId
          ? { ...attachment, explanation }
          : attachment,
      );
      uploadedAttachmentsRef.current = next;
      return next;
    });
  }

  async function handleExtractFigma(slotId: string) {
    const slot = figmaSlots.find((candidate) => candidate.id === slotId);
    if (!slot) {
      return;
    }

    setError(null);
    setFigmaSlots((current) =>
      current.map((candidate) =>
        candidate.id === slotId
          ? { ...candidate, loading: true, error: null }
          : candidate,
      ),
    );

    try {
      const response = await postJson<FigmaExtractResponse>(
        "/api/figma/extract",
        { url: slot.url },
      );
      setFigmaSlots((current) =>
        current.map((candidate) =>
          candidate.id === slotId
            ? { ...candidate, figma: response.figma, error: null }
            : candidate,
        ),
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to extract Figma context.";
      setFigmaSlots((current) =>
        current.map((candidate) =>
          candidate.id === slotId
            ? { ...candidate, error: message }
            : candidate,
        ),
      );
    } finally {
      setFigmaSlots((current) =>
        current.map((candidate) =>
          candidate.id === slotId
            ? { ...candidate, loading: false }
            : candidate,
        ),
      );
    }
  }

  function updateFigmaSlot(
    slotId: string,
    update: Partial<Pick<FigmaContextSlot, "url" | "figma" | "error">>,
  ) {
    setFigmaSlots((current) =>
      current.map((slot) =>
        slot.id === slotId ? { ...slot, ...update } : slot,
      ),
    );
  }

  async function handleDownloadPackage() {
    if (!selectedTicket) {
      return;
    }

    setError(null);
    setDownloadingPackage(true);

    try {
      const jiraAttachments = selectedTicket.attachments.filter(
        (attachment) => !excludedJiraAttachmentIds.has(attachment.id),
      );
      const packagedJiraAttachments = await Promise.all(
        jiraAttachments.map(async (attachment): Promise<PackageAttachment> => {
          const response = await fetch(
            `/api/jira/attachments/${encodeURIComponent(selectedTicket.key)}/${encodeURIComponent(attachment.id)}`,
            { cache: "no-store" },
          );

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(
              payload?.error || `Unable to download ${attachment.filename}.`,
            );
          }

          const data = new Uint8Array(await response.arrayBuffer());
          return {
            id: `jira-${attachment.id}`,
            source: "jira",
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            size: data.byteLength,
            data,
            jiraAttachmentId: attachment.id,
            explanation:
              jiraAttachmentExplanations[attachment.id]?.trim() ?? "",
          };
        }),
      );
      const packagedUploads = await Promise.all(
        uploadedAttachments.map(
          async (attachment): Promise<PackageAttachment> => {
            const data = new Uint8Array(await attachment.file.arrayBuffer());
            return {
              id: attachment.id,
              source: "upload",
              filename: attachment.file.name,
              mimeType: attachment.file.type || "application/octet-stream",
              size: data.byteLength,
              data,
              jiraAttachmentId: null,
              explanation: attachment.explanation.trim(),
            };
          },
        ),
      );

      const packageInput: TicketToCodePackageInput = {
        generatedAt: new Date().toISOString(),
        ticket: selectedTicket,
        editedDescription,
        figmaContexts: figmaSlots.flatMap((slot) =>
          slot.figma ? [{ viewport: slot.viewport, context: slot.figma }] : [],
        ),
        attachments: [...packagedJiraAttachments, ...packagedUploads],
      };
      const folderName = getTicketToCodePackageFolderName(packageInput);
      const packageFiles = buildTicketToCodePackageFiles(packageInput);
      const zipEntries: Record<string, Uint8Array> = {};

      for (const [fileName, content] of Object.entries(packageFiles)) {
        zipEntries[`${folderName}/${fileName}`] =
          typeof content === "string" ? strToU8(content) : content;
      }

      const zipData = zipSync(zipEntries);
      const blob = new Blob([zipData], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (packageError) {
      setError(
        packageError instanceof Error
          ? packageError.message
          : "Unable to download AI packaged info.",
      );
    } finally {
      setDownloadingPackage(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,rgba(14,165,233,0.32),transparent_26%),radial-gradient(circle_at_84%_10%,rgba(168,85,247,0.26),transparent_24%),radial-gradient(circle_at_72%_70%,rgba(16,185,129,0.24),transparent_28%),linear-gradient(145deg,#202c40_0%,#324158_46%,#2a384d_100%)] bg-fixed px-4 py-8 text-slate-50 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-lg border border-white/12 bg-slate-950/55 px-5 py-5 shadow-[0_28px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                Workflow Apps
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                Ticket to Code
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Package Jira requirements and optional Figma context into a
                compact build brief for an IDE coding agent.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-200/30 bg-cyan-300/12 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/45 hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              <ArrowLeft aria-hidden="true" size={17} />
              Dashboard
            </Link>
          </div>
        </header>

        <div>
          <h2 className="text-xl font-semibold text-white">
            Create your build brief
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Move through each source, then download a package ready for
            implementation.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        {notices.length > 0 ? (
          <div className="space-y-2">
            {notices.map((notice, index) => (
              <p
                key={`ticket-notice-${index}`}
                className="rounded-lg border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100"
              >
                {notice}
              </p>
            ))}
          </div>
        ) : null}

        <SectionCard
          title="Select Assigned Or Developer Ticket"
          eyebrow="Jira Source"
          className="relative z-40"
          accent="cyan"
          allowOverflow
        >
          <TicketSelector
            tickets={tickets}
            selectedKey={selectedTicketKey}
            loading={loadingTickets}
            onSelectTicket={handleSelectTicket}
            onRefresh={loadTickets}
          />
        </SectionCard>

        <SectionCard
          title="Ticket Requirements"
          eyebrow="Editable Criteria"
          accent="amber"
        >
          <TicketContextPanel
            ticket={selectedTicket}
            description={editedDescription}
            onDescriptionChange={setEditedDescription}
          />
        </SectionCard>

        <SectionCard
          title="Attached Images and Files"
          eyebrow="Implementation References"
          accent="red"
        >
          {selectedTicket ? (
            <AttachedFilesPanel
              ticketKey={selectedTicket.key}
              jiraAttachments={selectedTicket.attachments.filter(
                (attachment) => !excludedJiraAttachmentIds.has(attachment.id),
              )}
              uploadedAttachments={uploadedAttachments}
              jiraExplanations={jiraAttachmentExplanations}
              onAddFiles={handleAddAttachmentFiles}
              onExcludeJiraAttachment={(attachmentId) =>
                setExcludedJiraAttachmentIds((current) =>
                  new Set(current).add(attachmentId),
                )
              }
              onRemoveUploadedAttachment={handleRemoveUploadedAttachment}
              onJiraExplanationChange={(attachmentId, explanation) =>
                setJiraAttachmentExplanations((current) => ({
                  ...current,
                  [attachmentId]: explanation,
                }))
              }
              onUploadedExplanationChange={updateUploadedAttachmentExplanation}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-red-200/30 bg-white/5 p-4 text-sm text-slate-300">
              Choose a ticket to load its attached images and files.
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Figma Context"
          eyebrow="Optional Desktop And Mobile Design Sources"
          accent="emerald"
        >
          <div className="space-y-6">
            <p className="text-sm leading-6 text-slate-200">
              Add a Desktop View, a Mobile View, or both. Each extraction is
              labeled by viewport in the coding-agent package.
            </p>
            {figmaSlots.map((slot, index) => (
              <div
                key={slot.id}
                className={index ? "border-t border-white/10 pt-6" : undefined}
              >
                <FigmaContextPanel
                  viewport={slot.viewport}
                  figmaUrl={slot.url}
                  figma={slot.figma}
                  loading={slot.loading}
                  error={slot.error}
                  onUrlChange={(url) =>
                    updateFigmaSlot(slot.id, { url, error: null })
                  }
                  onExtract={() => void handleExtractFigma(slot.id)}
                  onClear={() =>
                    updateFigmaSlot(slot.id, { figma: null, error: null })
                  }
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Package For Coding Agent"
          eyebrow="AI Packaged Info"
          accent="purple"
          actions={
            <button
              type="button"
              onClick={() => void handleDownloadPackage()}
              disabled={!selectedTicket || downloadingPackage}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-200/30 bg-cyan-300/12 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/45 hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download aria-hidden="true" size={17} />
              {downloadingPackage
                ? "Packaging..."
                : "Download AI Packaged Info"}
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-white/12 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-purple-200">
                Ticket
              </p>
              <p className="mt-2 text-base font-semibold text-slate-50">
                {selectedTicket?.key ?? "Not selected"}
              </p>
            </div>
            <div className="rounded-lg border border-white/12 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-purple-200">
                Requirements
              </p>
              <p className="mt-2 text-base font-semibold text-slate-50">
                {editedDescription.trim() ? "Ready" : "Empty"}
              </p>
            </div>
            <div className="rounded-lg border border-white/12 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-purple-200">
                Figma
              </p>
              <p className="mt-2 text-base font-semibold text-slate-50">
                {figmaSlots
                  .filter((slot) => slot.figma)
                  .map((slot) =>
                    slot.viewport === "desktop" ? "Desktop" : "Mobile",
                  )
                  .join(" + ") || "None"}
              </p>
            </div>
            <div className="rounded-lg border border-white/12 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-purple-200">
                Attachments
              </p>
              <p className="mt-2 text-base font-semibold text-slate-50">
                {(selectedTicket?.attachments.length ?? 0) -
                  excludedJiraAttachmentIds.size +
                  uploadedAttachments.length}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
