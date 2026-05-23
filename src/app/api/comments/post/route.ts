import { NextResponse } from "next/server";

import { postReviewComments } from "@/lib/gitlab";
import type { PostCommentsPayload } from "@/lib/types";

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
