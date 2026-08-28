"use client";

import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  PackageCheck,
} from "lucide-react";
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

const workflowSteps = [
  { id: "ticket", label: "Choose ticket", eyebrow: "Jira source" },
  { id: "requirements", label: "Requirements", eyebrow: "Mission details" },
  { id: "references", label: "References", eyebrow: "Files and images" },
  { id: "design", label: "Design context", eyebrow: "Optional Figma" },
] as const;

type WorkflowStepId = (typeof workflowSteps)[number]["id"];

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
  const [activeStep, setActiveStep] = useState<WorkflowStepId>("ticket");
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

    if (ticket) {
      setActiveStep("requirements");
    }
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

  const includedAttachmentCount =
    (selectedTicket?.attachments.length ?? 0) -
    excludedJiraAttachmentIds.size +
    uploadedAttachments.length;
  const figmaContextCount = figmaSlots.filter((slot) => slot.figma).length;
  const completedSteps: Record<WorkflowStepId, boolean> = {
    ticket: Boolean(selectedTicket),
    requirements: Boolean(selectedTicket && editedDescription.trim()),
    references: includedAttachmentCount > 0,
    design: figmaContextCount > 0,
  };
  const includedSourceCount =
    Object.values(completedSteps).filter(Boolean).length;
  const activeStepIndex = workflowSteps.findIndex(
    (step) => step.id === activeStep,
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,rgba(14,165,233,0.32),transparent_26%),radial-gradient(circle_at_84%_10%,rgba(168,85,247,0.26),transparent_24%),radial-gradient(circle_at_72%_70%,rgba(16,185,129,0.24),transparent_28%),linear-gradient(145deg,#29384e_0%,#3d5069_46%,#34465d_100%)] bg-fixed px-4 py-8 text-slate-50 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-375 flex-col gap-6">
        <header className="rounded-lg border border-white/12 bg-slate-950/55 px-5 py-5 shadow-[0_28px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                  Developer acceleration
                </p>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                  Hackweek
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                Code Hero
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Suit up with Jira requirements, reference files, and Figma
                designs, then send a code-ready mission package to your coding
                agent.
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

        <div className="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)_280px] xl:grid-cols-[240px_minmax(0,1fr)_300px]">
          <nav
            aria-label="Code package steps"
            className="grid grid-cols-1 gap-2 rounded-lg border border-white/12 bg-slate-950/58 p-3 shadow-[0_22px_70px_rgba(2,6,23,0.3)] backdrop-blur-xl sm:grid-cols-2 lg:sticky lg:top-6 lg:grid-cols-1"
          >
            <div className="mb-1 px-2 sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Code package
              </p>
            </div>
            {workflowSteps.map((step, index) => {
              const isActive = step.id === activeStep;
              const isComplete = completedSteps[step.id];

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  aria-current={isActive ? "step" : undefined}
                  className={`group flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-cyan-300/35 bg-cyan-300/12"
                      : "border-transparent hover:border-white/10 hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${
                      isComplete
                        ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-200"
                        : isActive
                          ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                          : "border-white/10 bg-white/5 text-slate-400"
                    }`}
                  >
                    {isComplete ? (
                      <Check aria-hidden="true" size={15} />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">
                      {step.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {step.eyebrow}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 space-y-4">
            {activeStep === "ticket" ? (
              <SectionCard
                title="Choose your Jira ticket"
                eyebrow="Step 1 of 4"
                className="relative z-40 min-h-140"
                accent="cyan"
                allowOverflow
              >
                <p className="mb-5 max-w-2xl text-sm leading-6 text-slate-300">
                  Start with the source of truth. Selecting a ticket loads its
                  requirements and linked attachments into this workspace.
                </p>
                <TicketSelector
                  tickets={tickets}
                  selectedKey={selectedTicketKey}
                  loading={loadingTickets}
                  onSelectTicket={handleSelectTicket}
                  onRefresh={loadTickets}
                />
              </SectionCard>
            ) : null}

            {activeStep === "requirements" ? (
              <SectionCard
                title="Shape the mission requirements"
                eyebrow="Step 2 of 4"
                className="min-h-140"
                accent="amber"
              >
                <TicketContextPanel
                  ticket={selectedTicket}
                  description={editedDescription}
                  onDescriptionChange={setEditedDescription}
                />
              </SectionCard>
            ) : null}

            {activeStep === "references" ? (
              <SectionCard
                title="Add implementation references"
                eyebrow="Step 3 of 4"
                className="min-h-140"
                accent="red"
              >
                {selectedTicket ? (
                  <AttachedFilesPanel
                    ticketKey={selectedTicket.key}
                    jiraAttachments={selectedTicket.attachments.filter(
                      (attachment) =>
                        !excludedJiraAttachmentIds.has(attachment.id),
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
                    onUploadedExplanationChange={
                      updateUploadedAttachmentExplanation
                    }
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-red-200/30 bg-white/5 p-4 text-sm text-slate-300">
                    Choose a ticket first to load its attached files.
                  </div>
                )}
              </SectionCard>
            ) : null}

            {activeStep === "design" ? (
              <SectionCard
                title="Connect the intended experience"
                eyebrow="Step 4 of 4 · Optional"
                className="min-h-140"
                accent="emerald"
              >
                <div className="space-y-6">
                  <p className="text-sm leading-6 text-slate-300">
                    Add desktop, mobile, or both Figma views. Extracted design
                    details are labeled by viewport in the final package.
                  </p>
                  {figmaSlots.map((slot, index) => (
                    <div
                      key={slot.id}
                      className={
                        index ? "border-t border-white/10 pt-6" : undefined
                      }
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
                          updateFigmaSlot(slot.id, {
                            figma: null,
                            error: null,
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setActiveStep(workflowSteps[activeStepIndex - 1].id)
                }
                disabled={activeStepIndex === 0}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-slate-950/35 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-950/55 disabled:invisible"
              >
                <ChevronLeft aria-hidden="true" size={17} />
                Back
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveStep(workflowSteps[activeStepIndex + 1].id)
                }
                disabled={activeStepIndex === workflowSteps.length - 1}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-cyan-200/30 bg-cyan-300/12 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/20 disabled:invisible"
              >
                Next
                <ChevronRight aria-hidden="true" size={17} />
              </button>
            </div>
          </div>

          <aside className="rounded-lg border border-white/12 bg-slate-950/70 p-5 shadow-[0_22px_70px_rgba(2,6,23,0.38)] backdrop-blur-xl lg:sticky lg:top-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-300/20 bg-violet-300/10 text-violet-200">
                <PackageCheck aria-hidden="true" size={20} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">
                  Package preview
                </p>
                <h2 className="mt-1 text-base font-semibold text-white">
                  {selectedTicket?.key ?? "Code package"}
                </h2>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Sources included</span>
                <span className="font-semibold text-white">
                  {includedSourceCount}/4
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-linear-to-r from-cyan-400 to-emerald-400 transition-[width] duration-500"
                  style={{ width: `${includedSourceCount * 25}%` }}
                />
              </div>
            </div>

            <div className="mt-5 divide-y divide-white/8 border-y border-white/8">
              {[
                ["Jira ticket", selectedTicket?.key ?? "Not selected"],
                [
                  "Requirements",
                  editedDescription.trim() ? "Included" : "Not included",
                ],
                [
                  "Reference files",
                  includedAttachmentCount
                    ? `${includedAttachmentCount} included`
                    : "Optional",
                ],
                [
                  "Figma views",
                  figmaContextCount
                    ? `${figmaContextCount} included`
                    : "Optional",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 py-3 text-xs"
                >
                  <span className="text-slate-400">{label}</span>
                  <span className="truncate font-medium text-slate-100">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-white/4 p-3 font-mono text-xs leading-6 text-slate-300">
              <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
                Package contents
              </p>
              <p>manifest.json</p>
              <p>ticket.md</p>
              <p>agent-prompt.md</p>
              {figmaSlots.flatMap((slot) =>
                slot.figma ? (
                  <p key={slot.id}>figma-context-{slot.viewport}.json</p>
                ) : (
                  []
                ),
              )}
              {includedAttachmentCount ? (
                <p>attachments/ ({includedAttachmentCount})</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void handleDownloadPackage()}
              disabled={!selectedTicket || downloadingPackage}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-cyan-200/30 bg-cyan-300/15 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/45 hover:bg-cyan-300/25 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Download aria-hidden="true" size={17} />
              {downloadingPackage ? "Packaging..." : "Download code package"}
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Jira selection is required. References and design context are
              optional.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
