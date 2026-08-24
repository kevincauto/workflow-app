"use client";

import { useEffect, useState } from "react";

import { strToU8, zipSync } from "fflate";
import Link from "next/link";

import { MergeRequestThreadsPanel } from "@/components/MergeRequestThreadsPanel";
import { MrDetailsCard } from "@/components/MrDetailsCard";
import { MrUrlForm } from "@/components/MrUrlForm";
import { SectionCard } from "@/components/SectionCard";
import {
  buildThreadResolutionAgentPrompt,
  buildThreadResolutionManifest,
  buildThreadResolutionPatch,
  buildThreadResolutionSummary,
  buildThreadResolutionThreads,
  getThreadResolutionPackageFolderName,
  groupMergeRequestThreads,
} from "@/lib/threadResolutionPackage";
import type {
  ListOpenMergeRequestsResponse,
  LoadMrCommentsResponse,
  LoadMrResponse,
  MergeRequestComment,
  MergeRequestContext,
  OpenMergeRequestOption,
} from "@/lib/types";

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

function WorkflowEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-[9px] font-bold leading-none text-slate-950 shadow-sm">
        AR
      </span>
      {children}
    </>
  );
}

function AllThreadsResolvedHeader() {
  return (
    <header className="rounded-[28px] border border-sky-100/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.82)_0%,rgba(30,41,59,0.82)_48%,rgba(63,36,57,0.72)_100%)] p-6 shadow-[0_32px_100px_rgba(2,6,23,0.48),inset_0_1px_0_rgba(224,242,254,0.16)] backdrop-blur-xl sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/85">
            Feedback Verification
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-5xl">
            Are All Threads Resolved?
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
            Package every human GitLab discussion and the current merge request
            diff for an IDE agent to verify the feedback and look for remaining
            issues.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-sky-100/20 bg-slate-950/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-950/45 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Back to Dashboard
        </Link>
      </div>
    </header>
  );
}

export function AllThreadsResolvedDashboard() {
  const [mrUrl, setMrUrl] = useState("");
  const [openMergeRequests, setOpenMergeRequests] = useState<
    OpenMergeRequestOption[]
  >([]);
  const [selectedOpenMr, setSelectedOpenMr] = useState("");
  const [mergeRequest, setMergeRequest] = useState<MergeRequestContext | null>(
    null,
  );
  const [comments, setComments] = useState<MergeRequestComment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [loadingMr, setLoadingMr] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingOpenMrs, setLoadingOpenMrs] = useState(false);

  async function loadOpenMergeRequests() {
    setLoadingOpenMrs(true);

    try {
      const response = await fetch("/api/mr/load", { cache: "no-store" });
      const data = (await response.json()) as ListOpenMergeRequestsResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to list open merge requests.");
      }

      setOpenMergeRequests(data.mergeRequests);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to list open merge requests.",
      );
    } finally {
      setLoadingOpenMrs(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOpenMergeRequests();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function handleSelectOpenMr(value: string) {
    setSelectedOpenMr(value);

    if (value) {
      setMrUrl(value);
    }
  }

  async function handleLoadMergeRequest() {
    setError(null);
    setNotices([]);
    setMergeRequest(null);
    setComments([]);
    setLoadingMr(true);
    setLoadingComments(false);

    try {
      const data = await postJson<LoadMrResponse>("/api/mr/load", { mrUrl });
      setMergeRequest(data.mergeRequest);
      setNotices(data.notices);
      setLoadingMr(false);
      setLoadingComments(true);

      const commentsData = await postJson<LoadMrCommentsResponse>(
        "/api/mr/comments",
        { mergeRequest: data.mergeRequest },
      );
      setComments(commentsData.comments);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load merge request discussions.",
      );
    } finally {
      setLoadingMr(false);
      setLoadingComments(false);
    }
  }

  function handleExportPackage() {
    if (!mergeRequest || loadingComments) {
      return;
    }

    const packageInput = {
      generatedAt: new Date().toISOString(),
      mergeRequest,
      comments,
    };
    const folderName = getThreadResolutionPackageFolderName(packageInput);
    const zipData = zipSync({
      [`${folderName}/manifest.json`]: strToU8(
        JSON.stringify(buildThreadResolutionManifest(packageInput), null, 2),
      ),
      [`${folderName}/summary.md`]: strToU8(
        buildThreadResolutionSummary(packageInput),
      ),
      [`${folderName}/threads.md`]: strToU8(
        buildThreadResolutionThreads(packageInput),
      ),
      [`${folderName}/changes.patch`]: strToU8(
        buildThreadResolutionPatch(packageInput),
      ),
      [`${folderName}/agent-prompt.md`]: strToU8(
        buildThreadResolutionAgentPrompt(packageInput),
      ),
    });
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

  const threads = groupMergeRequestThreads(comments);
  const statusCounts = threads.reduce(
    (counts, thread) => {
      counts[thread.status] += 1;
      return counts;
    },
    { resolved: 0, unresolved: 0, "not-resolvable": 0 },
  );
  const canExport = Boolean(mergeRequest) && !loadingComments;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_4%,rgba(14,165,233,0.25),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(244,114,182,0.18),transparent_24%),radial-gradient(circle_at_66%_62%,rgba(16,185,129,0.16),transparent_28%),linear-gradient(145deg,#071827_0%,#172033_44%,#2c1f34_72%,#090f17_100%)] bg-fixed px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <AllThreadsResolvedHeader />

        <SectionCard
          title="Select a Merge Request"
          eyebrow={<WorkflowEyebrow>Choose Review Target</WorkflowEyebrow>}
          className="relative z-40"
        >
          <MrUrlForm
            value={mrUrl}
            onChange={setMrUrl}
            onSubmit={handleLoadMergeRequest}
            loading={loadingMr || loadingComments}
            openMergeRequests={openMergeRequests}
            selectedOpenMr={selectedOpenMr}
            onSelectOpenMr={handleSelectOpenMr}
            onRefreshOpenMrs={loadOpenMergeRequests}
            loadingOpenMrs={loadingOpenMrs}
          />
          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          ) : null}
          {notices.length > 0 ? (
            <div className="mt-4 space-y-2">
              {notices.map((notice, index) => (
                <p
                  key={`notice-${index}`}
                  className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100"
                >
                  {notice}
                </p>
              ))}
            </div>
          ) : null}
        </SectionCard>

        {mergeRequest ? (
          <SectionCard
            title="Merge Request Summary"
            eyebrow={<WorkflowEyebrow>Review Target</WorkflowEyebrow>}
          >
            <MrDetailsCard mergeRequest={mergeRequest} />
          </SectionCard>
        ) : null}

        {mergeRequest ? (
          <SectionCard
            title="GitLab Discussions"
            eyebrow={<WorkflowEyebrow>All Human Threads</WorkflowEyebrow>}
            actions={
              loadingComments ? null : (
                <p className="rounded-full border border-sky-100/20 bg-slate-950/45 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-sky-100">
                  {threads.length} threads · {statusCounts.unresolved} unresolved
                </p>
              )
            }
          >
            {loadingComments ? (
              <div className="rounded-2xl border border-white/12 bg-slate-950/35 px-4 py-6 text-sm text-slate-100">
                Loading merge request discussions...
              </div>
            ) : (
              <MergeRequestThreadsPanel comments={comments} />
            )}
          </SectionCard>
        ) : null}

        {mergeRequest ? (
          <SectionCard
            title="Prepare Verification Package"
            eyebrow={<WorkflowEyebrow>IDE Agent Handoff</WorkflowEyebrow>}
          >
            <div className="flex flex-col gap-4 rounded-3xl border border-sky-100/15 bg-slate-950/45 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {threads.length} discussions and {comments.length} notes ready
                </p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-200">
                  Download the discussions, MR metadata, patch, and instructions
                  for evidence-based verification and a fresh regression review.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportPackage}
                disabled={!canExport}
                className="min-h-13 shrink-0 rounded-2xl border border-sky-100/60 bg-[linear-gradient(180deg,#bae6fd_0%,#34d399_100%)] px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_16px_40px_rgba(14,165,233,0.2),inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                Download Verification Package
              </button>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </main>
  );
}
