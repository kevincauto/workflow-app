"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { strToU8, zipSync } from "fflate";

import { FigmaContextPanel } from "@/components/FigmaContextPanel";
import { SectionCard } from "@/components/SectionCard";
import { TicketContextPanel } from "@/components/TicketContextPanel";
import type { UploadedTicketImage } from "@/components/TicketImagesPanel";
import { TicketSelector } from "@/components/TicketSelector";
import {
  buildTicketToCodePackageFiles,
  getTicketToCodePackageFolderName,
} from "@/lib/ticketToCodePackage";
import type {
  FigmaExtractResponse,
  JiraTicketOption,
  ListAssignedJiraTicketsResponse,
  NormalizedFigmaContext,
  PackageImage,
  TicketToCodePackageInput,
} from "@/lib/types";

interface FigmaContextSlot {
  id: string;
  url: string;
  figma: NormalizedFigmaContext | null;
  loading: boolean;
}

function createFigmaSlot(id: string): FigmaContextSlot {
  return { id, url: "", figma: null, loading: false };
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
    createFigmaSlot("figma-1"),
  ]);
  const [uploadedImages, setUploadedImages] = useState<UploadedTicketImage[]>(
    [],
  );
  const [excludedJiraImageIds, setExcludedJiraImageIds] = useState<Set<string>>(
    new Set(),
  );
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [downloadingPackage, setDownloadingPackage] = useState(false);
  const selectedTicketKeyRef = useRef("");
  const uploadedImagesRef = useRef<UploadedTicketImage[]>([]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.key === selectedTicketKey) ?? null,
    [selectedTicketKey, tickets],
  );

  const clearTicketImages = useCallback(() => {
    for (const image of uploadedImagesRef.current) {
      URL.revokeObjectURL(image.previewUrl);
    }

    uploadedImagesRef.current = [];
    setUploadedImages([]);
    setExcludedJiraImageIds(new Set());
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
        clearTicketImages();
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
  }, [clearTicketImages]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTickets();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTickets]);

  useEffect(
    () => () => {
      for (const image of uploadedImagesRef.current) {
        URL.revokeObjectURL(image.previewUrl);
      }
    },
    [],
  );

  function handleSelectTicket(key: string) {
    const ticket = tickets.find((candidate) => candidate.key === key) ?? null;

    selectedTicketKeyRef.current = key;
    setSelectedTicketKey(key);
    setEditedDescription(ticket?.description ?? "");
    clearTicketImages();
  }

  function handleAddImageFiles(files: File[]) {
    setUploadedImages((current) => {
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
          },
        ];
      });
      const next = [...current, ...additions];
      uploadedImagesRef.current = next;
      return next;
    });
  }

  function handleRemoveUploadedImage(imageId: string) {
    setUploadedImages((current) => {
      const removed = current.find((image) => image.id === imageId);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      const next = current.filter((image) => image.id !== imageId);
      uploadedImagesRef.current = next;
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
        candidate.id === slotId ? { ...candidate, loading: true } : candidate,
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
            ? { ...candidate, figma: response.figma }
            : candidate,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to extract Figma context.",
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
    update: Partial<Pick<FigmaContextSlot, "url" | "figma">>,
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
      const jiraImages = selectedTicket.imageAttachments.filter(
        (image) => !excludedJiraImageIds.has(image.id),
      );
      const packagedJiraImages = await Promise.all(
        jiraImages.map(async (image): Promise<PackageImage> => {
          const response = await fetch(
            `/api/jira/attachments/${encodeURIComponent(selectedTicket.key)}/${encodeURIComponent(image.id)}`,
            { cache: "no-store" },
          );

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(
              payload?.error || `Unable to download ${image.filename}.`,
            );
          }

          const data = new Uint8Array(await response.arrayBuffer());
          return {
            id: `jira-${image.id}`,
            source: "jira",
            filename: image.filename,
            mimeType: image.mimeType,
            size: data.byteLength,
            data,
            jiraAttachmentId: image.id,
          };
        }),
      );
      const packagedUploads = await Promise.all(
        uploadedImages.map(async (image): Promise<PackageImage> => {
          const data = new Uint8Array(await image.file.arrayBuffer());
          return {
            id: image.id,
            source: "upload",
            filename: image.file.name,
            mimeType: image.file.type,
            size: data.byteLength,
            data,
            jiraAttachmentId: null,
          };
        }),
      );

      const packageInput: TicketToCodePackageInput = {
        generatedAt: new Date().toISOString(),
        ticket: selectedTicket,
        editedDescription,
        figmaContexts: figmaSlots.flatMap((slot) =>
          slot.figma ? [slot.figma] : [],
        ),
        images: [...packagedJiraImages, ...packagedUploads],
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
    <main className="min-h-screen bg-[linear-gradient(140deg,#04111f_0%,#12343b_42%,#3a2a1d_74%,#07111f_100%)] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[28px] border border-white/20 bg-slate-950/35 p-6 shadow-[0_32px_100px_rgba(2,6,23,0.42)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                Workflow Apps
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-50 sm:text-5xl">
                Ticket to Code
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
                Package Jira requirements and optional Figma context into a
                compact build brief for an IDE coding agent.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 bg-slate-950/30 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-950/45 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Back to Dashboard
            </Link>
          </div>
        </header>

        {error ? (
          <p className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        {notices.length > 0 ? (
          <div className="space-y-2">
            {notices.map((notice, index) => (
              <p
                key={`ticket-notice-${index}`}
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100"
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
        >
          <TicketSelector
            tickets={tickets}
            selectedKey={selectedTicketKey}
            loading={loadingTickets}
            onSelectTicket={handleSelectTicket}
            onRefresh={loadTickets}
          />
        </SectionCard>

        <SectionCard title="Ticket Requirements" eyebrow="Editable Criteria">
          <TicketContextPanel
            ticket={selectedTicket}
            description={editedDescription}
            onDescriptionChange={setEditedDescription}
            uploadedImages={uploadedImages}
            excludedJiraImageIds={excludedJiraImageIds}
            onAddImageFiles={handleAddImageFiles}
            onExcludeJiraImage={(attachmentId) =>
              setExcludedJiraImageIds((current) =>
                new Set(current).add(attachmentId),
              )
            }
            onRemoveUploadedImage={handleRemoveUploadedImage}
          />
        </SectionCard>

        <SectionCard title="Figma Context" eyebrow="Optional Design Source">
          <div className="space-y-6">
            {figmaSlots.map((slot, index) => (
              <div
                key={slot.id}
                className={index ? "border-t border-white/10 pt-6" : undefined}
              >
                <FigmaContextPanel
                  label={`Figma Context ${index + 1}`}
                  figmaUrl={slot.url}
                  figma={slot.figma}
                  loading={slot.loading}
                  canAdd={
                    index === 0 && Boolean(slot.figma) && figmaSlots.length < 2
                  }
                  removable={index > 0}
                  onUrlChange={(url) => updateFigmaSlot(slot.id, { url })}
                  onExtract={() => void handleExtractFigma(slot.id)}
                  onClear={() => updateFigmaSlot(slot.id, { figma: null })}
                  onAdd={() =>
                    setFigmaSlots((current) =>
                      current.length < 2
                        ? [...current, createFigmaSlot("figma-2")]
                        : current,
                    )
                  }
                  onRemove={() =>
                    setFigmaSlots((current) =>
                      current.filter((candidate) => candidate.id !== slot.id),
                    )
                  }
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Package For Coding Agent"
          eyebrow="AI Packaged Info"
          actions={
            <button
              type="button"
              onClick={() => void handleDownloadPackage()}
              disabled={!selectedTicket || downloadingPackage}
              className="rounded-2xl bg-orange-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_44px_rgba(251,146,60,0.28)] transition hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloadingPackage
                ? "Packaging..."
                : "Download AI Packaged Info"}
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                Ticket
              </p>
              <p className="mt-2 text-base font-semibold text-slate-50">
                {selectedTicket?.key ?? "Not selected"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                Requirements
              </p>
              <p className="mt-2 text-base font-semibold text-slate-50">
                {editedDescription.trim() ? "Ready" : "Empty"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                Figma
              </p>
              <p className="mt-2 text-base font-semibold text-slate-50">
                {figmaSlots.filter((slot) => slot.figma).length} of 2
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                Images
              </p>
              <p className="mt-2 text-base font-semibold text-slate-50">
                {(selectedTicket?.imageAttachments.length ?? 0) -
                  excludedJiraImageIds.size +
                  uploadedImages.length}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
