"use client";

import { useEffect, useState } from "react";

import { FindingsList } from "@/components/FindingsList";
import { JiraPanel } from "@/components/JiraPanel";
import { MrDetailsCard } from "@/components/MrDetailsCard";
import { MrUrlForm } from "@/components/MrUrlForm";
import { PostResultsPanel } from "@/components/PostResultsPanel";
import { ReviewControls } from "@/components/ReviewControls";
import { ReviewSummary } from "@/components/ReviewSummary";
import { SectionCard } from "@/components/SectionCard";
import type {
  JiraCandidate,
  JiraIssue,
  ListOpenMergeRequestsResponse,
  LoadMrResponse,
  MergeRequestContext,
  OpenMergeRequestOption,
  PostResult,
  ReviewFinding,
  ReviewResult,
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

export function ReviewDashboard() {
  const [mrUrl, setMrUrl] = useState("");
  const [openMergeRequests, setOpenMergeRequests] = useState<
    OpenMergeRequestOption[]
  >([]);
  const [selectedOpenMr, setSelectedOpenMr] = useState("");
  const [mergeRequest, setMergeRequest] = useState<MergeRequestContext | null>(
    null,
  );
  const [jiraCandidates, setJiraCandidates] = useState<JiraCandidate[]>([]);
  const [selectedJiraKey, setSelectedJiraKey] = useState("");
  const [jiraIssue, setJiraIssue] = useState<JiraIssue | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [postResults, setPostResults] = useState<PostResult[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMr, setLoadingMr] = useState(false);
  const [loadingJira, setLoadingJira] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [posting, setPosting] = useState(false);
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
    void loadOpenMergeRequests();
  }, []);

  useEffect(() => {
    if (!selectedOpenMr) {
      return;
    }

    setMrUrl(selectedOpenMr);
  }, [selectedOpenMr]);

  async function handleLoadMergeRequest() {
    setError(null);
    setReview(null);
    setPostResults([]);
    setLoadingMr(true);

    try {
      const data = await postJson<LoadMrResponse>("/api/mr/load", { mrUrl });
      setMergeRequest(data.mergeRequest);
      setJiraCandidates(data.jiraCandidates);
      setSelectedJiraKey(data.jiraCandidates[0]?.key ?? "");
      setJiraIssue(data.jiraIssue);
      setNotices(data.notices);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load merge request.",
      );
    } finally {
      setLoadingMr(false);
    }
  }

  async function handleResolveJira() {
    if (!selectedJiraKey) {
      return;
    }

    setError(null);
    setLoadingJira(true);

    try {
      const data = await postJson<{ jiraIssue: JiraIssue }>(
        "/api/jira/resolve",
        {
          key: selectedJiraKey,
        },
      );
      setJiraIssue(data.jiraIssue);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to resolve Jira issue.",
      );
    } finally {
      setLoadingJira(false);
    }
  }

  async function handleGenerateReview() {
    if (!mergeRequest) {
      return;
    }

    setError(null);
    setLoadingReview(true);
    setPostResults([]);

    try {
      const data = await postJson<ReviewResult>("/api/review/generate", {
        mergeRequest,
        jiraIssue,
      });
      setReview(data);
      setNotices((current) => [
        ...current.filter((notice) => !notice.startsWith("Review source:")),
        `Review source: ${data.source}. Retrieval gathered ${data.retrieval.relatedFiles.length} related files.`,
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate review.",
      );
    } finally {
      setLoadingReview(false);
    }
  }

  function updateFinding(
    id: string,
    updater: (finding: ReviewFinding) => ReviewFinding,
  ) {
    setReview((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        findings: current.findings.map((finding) =>
          finding.id === id ? updater(finding) : finding,
        ),
      };
    });
  }

  async function handlePostApproved() {
    if (!mergeRequest || !review) {
      return;
    }

    setError(null);
    setPosting(true);

    try {
      const data = await postJson<{ results: PostResult[] }>(
        "/api/comments/post",
        {
          mergeRequest,
          findings: review.findings,
        },
      );
      setPostResults(data.results);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to post comments.",
      );
    } finally {
      setPosting(false);
    }
  }

  const approvedCount =
    review?.findings.filter((finding) => finding.approved).length ?? 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_8%_12%,_rgba(125,211,252,0.44),_transparent_20%),radial-gradient(circle_at_88%_10%,_rgba(96,165,250,0.30),_transparent_18%),radial-gradient(circle_at_92%_74%,_rgba(56,189,248,0.28),_transparent_24%),radial-gradient(circle_at_18%_86%,_rgba(14,165,233,0.22),_transparent_18%),radial-gradient(circle_at_48%_38%,_rgba(59,130,246,0.18),_transparent_26%),linear-gradient(155deg,_#010312_0%,_#071426_24%,_#0c1630_48%,_#031b2d_72%,_#020617_100%)] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[32px] border border-white/10 bg-black/20 px-6 py-8 shadow-[0_28px_120px_rgba(8,15,31,0.5)] backdrop-blur">
          <p className="text-md font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            Diagnose Risky Code Before You Merge
          </p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Merge Medic AI 👨🏼‍⚕️🏥
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
                An automated code review assistant, fully integrated with GitLab
                and Jira, powered by AI, and ready to help supercharge your
                peer-review workflow by avoiding bugs and security issues in
                your codebase.
                {/* <li>Load a GitLab merge request</li>
                <li>Enrich it with Jira acceptance context</li>
                <li>Generate high-value review comments, edit approvals,</li>
                <li>And post the approved set back to GitLab.</li> */}
              </p>
            </div>
            {/* <div className="rounded-3xl border border-cyan-300/25 bg-cyan-400/8 px-5 py-4 text-sm text-cyan-50">
              Demo-ready with live integrations when env vars are configured,
              and resilient mock mode when they are not.
            </div> */}
          </div>
        </header>

        <SectionCard
          title="Select an open merge request from the dropdown or paste in a url."
          eyebrow="1. Select A Patient 🤒🤕"
          className="relative z-40"
        >
          <MrUrlForm
            value={mrUrl}
            onChange={setMrUrl}
            onSubmit={handleLoadMergeRequest}
            loading={loadingMr}
            openMergeRequests={openMergeRequests}
            selectedOpenMr={selectedOpenMr}
            onSelectOpenMr={setSelectedOpenMr}
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
                  className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200"
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
            eyebrow="2. Gather Medical History 🚑"
          >
            <MrDetailsCard mergeRequest={mergeRequest} />
          </SectionCard>
        ) : null}

        <SectionCard title="Jira Context" eyebrow="3. Check The Charts 📈">
          <JiraPanel
            candidates={jiraCandidates}
            jiraIssue={jiraIssue}
            selectedKey={selectedJiraKey}
            onSelectKey={setSelectedJiraKey}
            onResolve={handleResolveJira}
            loading={loadingJira}
          />
        </SectionCard>

        <SectionCard title="AI Review" eyebrow="4. Consult The Specialist 🧑‍⚕️">
          <ReviewControls
            onGenerate={handleGenerateReview}
            loading={loadingReview}
            canGenerate={Boolean(mergeRequest)}
          />
        </SectionCard>

        {review ? (
          <>
            <SectionCard title="Review Summary" eyebrow="5. Diagnosis 🩺">
              <ReviewSummary summary={review.summary} />
            </SectionCard>

            <SectionCard
              title="Edit and Review Findings"
              eyebrow="6. Treatment Plan 🏥"
            >
              <FindingsList
                findings={review.findings}
                onToggleApproved={(id, approved) =>
                  updateFinding(id, (finding) => ({ ...finding, approved }))
                }
                onCommentChange={(id, text) =>
                  updateFinding(id, (finding) => ({
                    ...finding,
                    commentText: text,
                  }))
                }
              />
            </SectionCard>

            <SectionCard
              title="Publish Comment Directly in GitLab"
              eyebrow="7. Discharge Patient ✅"
            >
              <PostResultsPanel
                results={postResults}
                onPost={handlePostApproved}
                loading={posting}
                approvedCount={approvedCount}
              />
            </SectionCard>
          </>
        ) : null}
      </div>
    </main>
  );
}
