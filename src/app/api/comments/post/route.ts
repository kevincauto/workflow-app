import { NextResponse } from "next/server";

import { postReviewComments } from "@/lib/gitlab";
import { appendReviewMetricsLog } from "@/lib/reviewMetricsLogger";
import type { ChangedFile, PostCommentsPayload } from "@/lib/types";

export const runtime = "nodejs";

function countChangedLines(changedFiles: ChangedFile[]) {
  return changedFiles.reduce(
    (totals, file) => {
      const lines = file.diff.split("\n");

      for (const line of lines) {
        if (line.startsWith("+++") || line.startsWith("---")) {
          continue;
        }

        if (line.startsWith("+")) {
          totals.linesAdded += 1;
        } else if (line.startsWith("-")) {
          totals.linesDeleted += 1;
        }
      }

      return totals;
    },
    { linesAdded: 0, linesDeleted: 0 },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostCommentsPayload;
    if (!body.mergeRequest) {
      return NextResponse.json(
        { error: "Merge request context is required." },
        { status: 400 },
      );
    }

    const approvedFindings = body.findings.filter(
      (finding) => finding.approved,
    );
    const results = await postReviewComments({
      mergeRequest: body.mergeRequest,
      findings: approvedFindings,
    });
    const postedFindingIds = new Set(
      results
        .filter((result) => result.status === "posted")
        .map((result) => result.findingId),
    );
    const postedFindings = approvedFindings.filter((finding) =>
      postedFindingIds.has(finding.id),
    );
    const changedLineCounts = countChangedLines(body.mergeRequest.changedFiles);

    if (postedFindings.length > 0) {
      appendReviewMetricsLog({
        mergeRequestUrl: body.mergeRequest.webUrl,
        mergeRequestTitle: body.mergeRequest.title,
        mergeRequestIid: body.mergeRequest.iid,
        projectId: body.mergeRequest.projectId,
        repoName: body.mergeRequest.projectName,
        repoPath: body.mergeRequest.projectPath,
        jiraKey: body.jiraKey,
        model: process.env.AITRIUM_MODEL_ID,
        generatedFindings: body.findings,
        postedFindings,
        filesChanged: body.mergeRequest.changedFiles.length,
        linesAdded: changedLineCounts.linesAdded,
        linesDeleted: changedLineCounts.linesDeleted,
        reviewDurationMs: body.reviewDurationMs,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to post comments.",
      },
      { status: 500 },
    );
  }
}
