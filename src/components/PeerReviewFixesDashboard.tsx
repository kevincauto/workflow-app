"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { MergeRequestCommentsPanel } from "@/components/MergeRequestCommentsPanel";
import { MrDetailsCard } from "@/components/MrDetailsCard";
import { MrUrlForm } from "@/components/MrUrlForm";
import { SectionCard } from "@/components/SectionCard";
import {
  buildPeerReviewFixesPrompt,
  getPeerReviewFixesFileName,
} from "@/lib/peerReviewFixesPackage";
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
      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold leading-none text-stone-950 shadow-sm">
        <span className="translate-x-0.5 translate-y-0.5">PR</span>
      </span>
      {children}
    </>
  );
}

function PeerReviewFixesHeader() {
  return (
    <header className="rounded-[28px] border border-amber-100/20 bg-[linear-gradient(135deg,rgba(28,25,23,0.84)_0%,rgba(63,36,57,0.68)_46%,rgba(20,83,45,0.42)_100%)] p-6 shadow-[0_32px_100px_rgba(28,25,23,0.48),inset_0_1px_0_rgba(254,243,199,0.16)] backdrop-blur-xl sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/85">
            Peer Review Fixes
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-stone-50 sm:text-5xl">
            Turn Review Feedback Into Focused Fixes
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-200">
            Select colleague comments from a merge request and export a concise
            markdown prompt that guides a coding agent through each response.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-amber-100/20 bg-stone-950/30 px-4 py-2 text-sm font-semibold text-stone-100 transition hover:bg-stone-950/45 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-stone-950"
        >
          Back to Dashboard
        </Link>
      </div>
    </header>
  );
}

export function PeerReviewFixesDashboard() {
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
        {
          mergeRequest: data.mergeRequest,
        },
      );
      setComments(
        commentsData.comments.map((comment) => ({
          ...comment,
          selected: false,
        })),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load merge request comments.",
      );
    } finally {
      setLoadingMr(false);
      setLoadingComments(false);
    }
  }

  function updateCommentSelection(id: string, selected: boolean) {
    setComments((current) =>
      current.map((comment) =>
        comment.id === id ? { ...comment, selected } : comment,
      ),
    );
  }

  function handleExportComments() {
    if (!mergeRequest) {
      return;
    }

    const packageInput = {
      generatedAt: new Date().toISOString(),
      mergeRequest,
      comments,
    };
    const markdown = buildPeerReviewFixesPrompt(packageInput);
    const blob = new Blob([markdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = getPeerReviewFixesFileName(packageInput);

    link.href = url;
    link.download = `${fileName}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const selectedCount = comments.filter((comment) => comment.selected).length;
  const canExport = Boolean(mergeRequest) && selectedCount > 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_14%_4%,rgba(251,191,36,0.28),transparent_24%),radial-gradient(circle_at_86%_10%,rgba(16,185,129,0.28),transparent_25%),radial-gradient(circle_at_64%_42%,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_18%_88%,rgba(244,114,182,0.16),transparent_24%),linear-gradient(145deg,#120f12_0%,#2d1b2f_34%,#17352f_68%,#0b1110_100%)] bg-fixed px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <PeerReviewFixesHeader />

        <SectionCard
          title="Select a Merge Request"
          eyebrow={<WorkflowEyebrow>Choose Review Feedback</WorkflowEyebrow>}
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
            title="Merge Request Comments"
            eyebrow={<WorkflowEyebrow>Colleague Feedback</WorkflowEyebrow>}
            actions={
              comments.length > 0 ? (
                <p className="rounded-full border border-amber-100/20 bg-stone-950/45 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
                  {selectedCount} of {comments.length} selected
                </p>
              ) : null
            }
          >
            {loadingComments ? (
              <div className="rounded-2xl border border-white/12 bg-slate-950/35 px-4 py-6 text-sm text-slate-100">
                Loading merge request comments...
              </div>
            ) : (
              <MergeRequestCommentsPanel
                comments={comments}
                onToggleComment={updateCommentSelection}
              />
            )}
          </SectionCard>
        ) : null}

        {mergeRequest ? (
          <SectionCard
            title="Export Selected Feedback"
            eyebrow={<WorkflowEyebrow>Prepare Agent Prompt</WorkflowEyebrow>}
          >
            <div className="flex flex-col gap-4 rounded-3xl border border-amber-100/15 bg-stone-950/45 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {selectedCount} comments ready for export
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  Download a markdown prompt for a coding agent to inspect and
                  respond to the selected peer review feedback.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportComments}
                disabled={!canExport}
                className="min-h-13 rounded-2xl border border-amber-100/60 bg-[linear-gradient(180deg,#fde68a_0%,#34d399_100%)] px-5 py-3 text-sm font-bold text-stone-950 shadow-[0_16px_40px_rgba(16,185,129,0.2),inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                Export These Comments
              </button>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </main>
  );
}
