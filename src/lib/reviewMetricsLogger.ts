import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

type MetricsSeverity = "high" | "medium" | "low";

type SeverityCounts = Record<MetricsSeverity, number>;

export interface ReviewMetricsFinding {
  id?: string;
  severity: "High" | "Medium" | "Low" | MetricsSeverity;
}

export interface AppendReviewMetricsLogInput {
  mergeRequestUrl: string;
  mergeRequestTitle?: string;
  mergeRequestIid?: number | string;
  projectId?: number | string;
  repoName?: string;
  repoPath?: string;
  jiraKey?: string;
  model?: string;

  generatedFindings: ReviewMetricsFinding[];
  postedFindings: ReviewMetricsFinding[];

  filesChanged?: number;
  linesAdded?: number;
  linesDeleted?: number;
  reviewDurationMs?: number;
}

export interface ReviewMetricsLogEntry {
  loggedAt: string;

  mergeRequestUrl: string;
  mergeRequestTitle?: string;
  mergeRequestIid?: number | string;
  projectId?: number | string;
  repoName?: string;
  repoPath?: string;
  jiraKey?: string;
  model?: string;

  generatedHighCount: number;
  generatedMediumCount: number;
  generatedLowCount: number;
  generatedTotalCount: number;

  postedHighCount: number;
  postedMediumCount: number;
  postedLowCount: number;
  postedTotalCount: number;

  usefulHighCount: number;
  usefulMediumCount: number;
  usefulLowCount: number;
  usefulTotalCount: number;

  hasGeneratedHighOrMediumFinding: boolean;
  hasPostedHighOrMediumFinding: boolean;

  filesChanged?: number;
  linesAdded?: number;
  linesDeleted?: number;
  reviewDurationMs?: number;
}

const logDirectory = path.join(process.cwd(), "logs");
const logFilePath = path.join(logDirectory, "merge-medic-review-log.jsonl");

function normalizeSeverity(
  severity: ReviewMetricsFinding["severity"],
): MetricsSeverity {
  return severity.toLowerCase() as MetricsSeverity;
}

function countBySeverity(findings: ReviewMetricsFinding[]): SeverityCounts {
  return findings.reduce<SeverityCounts>(
    (counts, finding) => {
      counts[normalizeSeverity(finding.severity)] += 1;
      return counts;
    },
    {
      high: 0,
      medium: 0,
      low: 0,
    },
  );
}

function totalCounts(counts: SeverityCounts) {
  return counts.high + counts.medium + counts.low;
}

export function appendReviewMetricsLog(
  input: AppendReviewMetricsLogInput,
): ReviewMetricsLogEntry {
  const generatedCounts = countBySeverity(input.generatedFindings);
  const postedCounts = countBySeverity(input.postedFindings);
  const generatedTotalCount = totalCounts(generatedCounts);
  const postedTotalCount = totalCounts(postedCounts);

  const entry: ReviewMetricsLogEntry = {
    loggedAt: new Date().toISOString(),
    mergeRequestUrl: input.mergeRequestUrl,
    mergeRequestTitle: input.mergeRequestTitle,
    mergeRequestIid: input.mergeRequestIid,
    projectId: input.projectId,
    repoName: input.repoName,
    repoPath: input.repoPath,
    jiraKey: input.jiraKey,
    model: input.model,
    generatedHighCount: generatedCounts.high,
    generatedMediumCount: generatedCounts.medium,
    generatedLowCount: generatedCounts.low,
    generatedTotalCount,
    postedHighCount: postedCounts.high,
    postedMediumCount: postedCounts.medium,
    postedLowCount: postedCounts.low,
    postedTotalCount,
    usefulHighCount: postedCounts.high,
    usefulMediumCount: postedCounts.medium,
    usefulLowCount: postedCounts.low,
    usefulTotalCount: postedTotalCount,
    hasGeneratedHighOrMediumFinding:
      generatedCounts.high > 0 || generatedCounts.medium > 0,
    hasPostedHighOrMediumFinding:
      postedCounts.high > 0 || postedCounts.medium > 0,
    filesChanged: input.filesChanged,
    linesAdded: input.linesAdded,
    linesDeleted: input.linesDeleted,
    reviewDurationMs: input.reviewDurationMs,
  };

  try {
    mkdirSync(logDirectory, { recursive: true });
    appendFileSync(logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.warn(
      "Review metrics logging failed; GitLab posting was not blocked.",
      error,
    );
  }

  return entry;
}
