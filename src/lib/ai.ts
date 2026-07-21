import {
  normalizeFindingsAgainstDiff,
  normalizeMarkdownBackticks,
} from "@/lib/lineMapping";
import { buildReviewPrompt } from "@/lib/prompt";
import type {
  JiraIssue,
  MergeRequestContext,
  RetrievalResult,
  ReviewFinding,
  ReviewResult,
  ReviewSummary,
} from "@/lib/types";

function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function isMockReviewModeEnabled() {
  return process.env.AI_REVIEW_MOCK_MODE === "true";
}

export class AiReviewUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiReviewUnavailableError";
  }
}

function createFinding(
  seed: Omit<ReviewFinding, "id" | "approved">,
  index: number,
): ReviewFinding {
  return {
    ...seed,
    commentText: normalizeMarkdownBackticks(seed.commentText),
    id: `finding-${index + 1}`,
    approved: true,
  };
}

function buildFallbackSummary(findings: ReviewFinding[]): ReviewSummary {
  const keyConcerns = findings
    .slice(0, 3)
    .map((finding) => finding.commentText);

  return {
    overview:
      findings.length > 0
        ? `Generated ${findings.length} review findings with emphasis on correctness, resilience, and requirement alignment.`
        : "No high-value findings were produced from the current diff.",
    keyConcerns,
    testingFocus: [
      "Run regression coverage on the changed user flow.",
      "Verify error paths and short-input handling around changed files.",
    ],
  };
}

function generateMockFindings(input: {
  mergeRequest: MergeRequestContext;
  jiraIssue: JiraIssue | null;
}) {
  const findings: ReviewFinding[] = [];
  let index = 0;

  for (const file of input.mergeRequest.changedFiles) {
    if (file.contentStatus !== "available") {
      continue;
    }

    const lines = file.content.split("\n");
    const anyLine = lines.findIndex(
      (line) => line.includes(": any") || line.includes("<any>"),
    );
    if (anyLine >= 0) {
      findings.push(
        createFinding(
          {
            filePath: file.newPath,
            lineStart: anyLine + 1,
            lineEnd: anyLine + 1,
            severity: "Medium",
            category: "Maintainability",
            commentText:
              "This change reintroduces an untyped `any`, which makes downstream profile access harder to reason about and easier to break silently.",
            rationale:
              "The changed file uses `any` for state where the previous implementation likely relied on a concrete profile type. That weakens compile-time guarantees around the reviewed flow.",
            isGeneralComment: false,
            codeSnippet: lines[anyLine]?.trim(),
          },
          index++,
        ),
      );
    }

    const consoleLine = lines.findIndex((line) => line.includes("console.log"));
    if (consoleLine >= 0) {
      findings.push(
        createFinding(
          {
            filePath: file.newPath,
            lineStart: consoleLine + 1,
            lineEnd: consoleLine + 1,
            severity: "Low",
            category: "Maintainability",
            commentText:
              "This debug log will fire in the shipped flow and can leak noisy state into production logs. Consider removing it before merge.",
            rationale:
              "The added line appears to be transient debugging rather than user-facing behavior, so it is better handled before posting a review-ready change.",
            isGeneralComment: false,
            codeSnippet: lines[consoleLine]?.trim(),
          },
          index++,
        ),
      );
    }

    const fetchLine = lines.findIndex(
      (line) =>
        line.includes("fetch(") || line.includes("await fetchCustomerProfile"),
    );
    if (
      fetchLine >= 0 &&
      !file.content.includes("catch") &&
      !file.content.includes("try {")
    ) {
      findings.push(
        createFinding(
          {
            filePath: file.newPath,
            lineStart: fetchLine + 1,
            lineEnd: fetchLine + 1,
            severity: "Medium",
            category: "Error Handling",
            commentText:
              "The async fetch path still assumes success. If this request rejects or returns a non-OK response, the UI stays stuck in loading without a recoverable error state.",
            rationale:
              "The acceptance context explicitly mentions graceful handling. The current implementation does not guard the request or branch into an empty or error state.",
            isGeneralComment: false,
            codeSnippet: lines[fetchLine]?.trim(),
          },
          index++,
        ),
      );
    }
  }

  const changedTest = input.mergeRequest.changedFiles.some((file) =>
    /\.(test|spec)\.(ts|tsx)$/.test(file.newPath),
  );
  if (!changedTest && input.mergeRequest.changedFiles.length > 0) {
    findings.push(
      createFinding(
        {
          filePath: input.mergeRequest.changedFiles[0]?.newPath ?? null,
          lineStart: null,
          lineEnd: null,
          severity: "Medium",
          category: "Test Gap",
          commentText:
            "This MR changes request and routing behavior but does not appear to add regression coverage for missing or short route segments.",
          rationale:
            "The Jira acceptance criteria call out a route-shape regression case. No corresponding test file was touched in the diff.",
          isGeneralComment: true,
          codeSnippet: undefined,
        },
        index++,
      ),
    );
  }

  if (
    input.jiraIssue?.description.includes("Do not call") &&
    input.mergeRequest.changedFiles[0]
  ) {
    findings.push(
      createFinding(
        {
          filePath: input.mergeRequest.changedFiles[0].newPath,
          lineStart: null,
          lineEnd: null,
          severity: "High",
          category: "Jira Mismatch",
          commentText:
            "The Jira acceptance criteria says not to call the profile API when the account id is missing, but the current effect still calls the fetch function unconditionally.",
          rationale:
            "The review context includes a hard requirement to skip the request when the route is incomplete. The current effect body has no guard before `fetchCustomerProfile(accountId)`.",
          isGeneralComment: true,
          codeSnippet: undefined,
        },
        index++,
      ),
    );
  }

  return findings.slice(0, 10);
}

function parseAiResponse(payload: unknown): {
  summary?: ReviewSummary;
  findings?: Array<Omit<ReviewFinding, "id" | "approved">>;
} {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return payload as {
    summary?: ReviewSummary;
    findings?: Array<Omit<ReviewFinding, "id" | "approved">>;
  };
}

const openAiSystemPrompt =
  "You are a senior engineer performing a merge request review. Return only valid JSON.";

function buildOpenAiRequestBody(input: {
  mergeRequest: MergeRequestContext;
  jiraIssue: JiraIssue | null;
  retrieval: RetrievalResult;
}) {
  return {
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content: openAiSystemPrompt,
      },
      {
        role: "user" as const,
        content: buildReviewPrompt(input),
      },
    ],
  };
}

export function buildOpenAiDebugPayload(input: {
  mergeRequest: MergeRequestContext;
  jiraIssue: JiraIssue | null;
  retrieval: RetrievalResult;
}) {
  return {
    endpoint:
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com/v1/chat/completions",
    method: "POST" as const,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer [REDACTED]",
    },
    body: buildOpenAiRequestBody(input),
  };
}

async function requestOpenAiReview(input: {
  mergeRequest: MergeRequestContext;
  jiraIssue: JiraIssue | null;
  retrieval: RetrievalResult;
}): Promise<ReviewResult> {
  const requestBody = buildOpenAiRequestBody(input);
  const response = await fetch(
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();
    const detail = responseText ? `: ${responseText.slice(0, 500)}` : "";

    throw new AiReviewUnavailableError(
      `AI review request failed with status ${response.status}${detail}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiReviewUnavailableError(
      "AI review response did not include content.",
    );
  }

  const parsed = parseAiResponse(JSON.parse(content));
  const rawFindings = (parsed.findings ?? []).slice(0, 10);
  const findings = normalizeFindingsAgainstDiff(
    input.mergeRequest,
    rawFindings.map((finding, index) => createFinding(finding, index)),
  );

  return {
    summary: parsed.summary ?? buildFallbackSummary(findings),
    findings,
    retrieval: input.retrieval,
    source: "live",
  };
}

export async function generateReview(input: {
  mergeRequest: MergeRequestContext;
  jiraIssue: JiraIssue | null;
  retrieval: RetrievalResult;
}): Promise<ReviewResult> {
  if (isAiConfigured()) {
    return requestOpenAiReview(input);
  }

  if (!isMockReviewModeEnabled()) {
    throw new AiReviewUnavailableError(
      "OPENAI_API_KEY is not configured. Add it to .env.local and restart the dev server, or set AI_REVIEW_MOCK_MODE=true to use demo review findings.",
    );
  }

  const findings = normalizeFindingsAgainstDiff(
    input.mergeRequest,
    generateMockFindings(input),
  );

  return {
    summary: buildFallbackSummary(findings),
    findings,
    retrieval: input.retrieval,
    source: "mock",
  };
}
