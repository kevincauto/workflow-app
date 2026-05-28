"use client";

import { type ReactNode, useEffect, useState } from "react";

import { FindingsList } from "@/components/FindingsList";
import { HeroLogo } from "@/components/HeroLogo";
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

function MedicalEyebrow({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm text-red-500 shadow-sm">
        <span className="translate-x-[2px] text-lg leading-none">✚</span>
      </span>
      {children}
    </>
  );
}

function SeverityRubricTooltip() {
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer rounded-full border border-white/20 bg-slate-950/45 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-orange-300 transition hover:bg-slate-950/60">
        Severity Rubric
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[320px] rounded-2xl border border-white/15 bg-slate-950/95 p-4 text-sm text-slate-100 shadow-[0_22px_60px_rgba(2,6,23,0.65)] backdrop-blur-xl">
        <p className="font-semibold text-orange-300">High</p>
        <p className="mt-1 text-slate-200">
          Likely production incident, security exposure, data loss/corruption,
          auth/permission bypass, or critical-path breakage.
        </p>

        <p className="mt-3 font-semibold text-orange-300">Medium</p>
        <p className="mt-1 text-slate-200">
          Meaningful functional or reliability impact. Jira acceptance-criteria
          mismatch is always at least Medium.
        </p>

        <p className="mt-3 font-semibold text-orange-300">Low</p>
        <p className="mt-1 text-slate-200">
          Non-blocking maintainability or observability improvements, minor
          edge cases, and test gaps by default.
        </p>
      </div>
    </details>
  );
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,_rgba(30,64,175,0.42),_transparent_24%),radial-gradient(circle_at_86%_12%,_rgba(79,70,229,0.42),_transparent_24%),radial-gradient(circle_at_78%_34%,_rgba(251,146,60,0.34),_transparent_20%),radial-gradient(circle_at_96%_72%,_rgba(34,211,238,0.42),_transparent_28%),radial-gradient(circle_at_12%_88%,_rgba(14,165,233,0.38),_transparent_24%),radial-gradient(circle_at_30%_66%,_rgba(249,115,22,0.26),_transparent_22%),radial-gradient(circle_at_54%_48%,_rgba(37,99,235,0.26),_transparent_32%),linear-gradient(155deg,_#020617_0%,_#082f49_22%,_#172554_46%,_#033348_72%,_#010312_100%)] bg-fixed px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <HeroLogo />

        <SectionCard
          title="Select a Merge Request or Paste a URL"
          eyebrow={
            <MedicalEyebrow>
              Select A Patient 🤒🤕😷
            </MedicalEyebrow>
          }
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
            eyebrow={
              <MedicalEyebrow>
                Gather Medical History 🚑
              </MedicalEyebrow>
            }
          >
            <MrDetailsCard mergeRequest={mergeRequest} />
          </SectionCard>
        ) : null}

        <SectionCard
          title="Jira Context"
          eyebrow={<MedicalEyebrow>Check The Charts 📈</MedicalEyebrow>}
        >
          <JiraPanel
            candidates={jiraCandidates}
            jiraIssue={jiraIssue}
            selectedKey={selectedJiraKey}
            onSelectKey={setSelectedJiraKey}
            onResolve={handleResolveJira}
            loading={loadingJira}
          />
        </SectionCard>

        <SectionCard
          title="Generate an AI-Powered Review"
          eyebrow={<MedicalEyebrow>Consult The Specialist 🧑‍⚕️</MedicalEyebrow>}
        >
          <ReviewControls
            onGenerate={handleGenerateReview}
            loading={loadingReview}
            canGenerate={Boolean(mergeRequest)}
          />
        </SectionCard>

        {review ? (
          <>
            <SectionCard
              title="Review Summary"
              eyebrow={<MedicalEyebrow>Diagnosis 🩺</MedicalEyebrow>}
            >
              <ReviewSummary summary={review.summary} />
            </SectionCard>

            <SectionCard
              title="Edit and Review Findings"
              eyebrow={<MedicalEyebrow>Treatment Plan 🏥</MedicalEyebrow>}
              actions={<SeverityRubricTooltip />}
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
              title="Publish Comments Directly in GitLab"
              eyebrow={<MedicalEyebrow>Discharge Patient ✅</MedicalEyebrow>}
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
