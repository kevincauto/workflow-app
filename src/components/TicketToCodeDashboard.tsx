"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { strToU8, zipSync } from "fflate";

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
  JiraTicketOption,
  ListAssignedJiraTicketsResponse,
  NormalizedFigmaContext,
  TicketToCodePackageInput,
} from "@/lib/types";

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
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figma, setFigma] = useState<NormalizedFigmaContext | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingFigma, setLoadingFigma] = useState(false);
  const selectedTicketKeyRef = useRef("");

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.key === selectedTicketKey) ?? null,
    [selectedTicketKey, tickets],
  );

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
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTickets();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTickets]);

  function handleSelectTicket(key: string) {
    const ticket = tickets.find((candidate) => candidate.key === key) ?? null;

    selectedTicketKeyRef.current = key;
    setSelectedTicketKey(key);
    setEditedDescription(ticket?.description ?? "");
  }

  async function handleExtractFigma() {
    setError(null);
    setLoadingFigma(true);

    try {
      const response = await postJson<FigmaExtractResponse>(
        "/api/figma/extract",
        { url: figmaUrl },
      );
      setFigma(response.figma);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to extract Figma context.",
      );
    } finally {
      setLoadingFigma(false);
    }
  }

  function handleClearFigma() {
    setFigma(null);
  }

  function handleDownloadPackage() {
    if (!selectedTicket) {
      return;
    }

    setError(null);

    const packageInput: TicketToCodePackageInput = {
      generatedAt: new Date().toISOString(),
      ticket: selectedTicket,
      editedDescription,
      figma,
    };
    const folderName = getTicketToCodePackageFolderName(packageInput);
    const packageFiles = buildTicketToCodePackageFiles(packageInput);
    const zipEntries: Record<string, Uint8Array> = {};

    for (const [fileName, content] of Object.entries(packageFiles)) {
      zipEntries[`${folderName}/${fileName}`] = strToU8(content);
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
          />
        </SectionCard>

        <SectionCard title="Figma Context" eyebrow="Optional Design Source">
          <FigmaContextPanel
            figmaUrl={figmaUrl}
            figma={figma}
            loading={loadingFigma}
            onUrlChange={setFigmaUrl}
            onExtract={handleExtractFigma}
            onClear={handleClearFigma}
          />
        </SectionCard>

        <SectionCard
          title="Package For Coding Agent"
          eyebrow="AI Packaged Info"
          actions={
            <button
              type="button"
              onClick={handleDownloadPackage}
              disabled={!selectedTicket}
              className="rounded-2xl bg-orange-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_44px_rgba(251,146,60,0.28)] transition hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download AI Packaged Info
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
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
                {figma ? "Attached" : "Not attached"}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
