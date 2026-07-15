import { NextResponse } from "next/server";

import { buildAiCenterReviewDebugPayload } from "@/lib/ai";
import { collectRetrievalContext } from "@/lib/retrieval";
import type { RetrievalResult, ReviewRequestPayload } from "@/lib/types";

export const runtime = "nodejs";

interface ReviewPayloadRequest extends ReviewRequestPayload {
  retrieval?: RetrievalResult;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReviewPayloadRequest;
    if (!body.mergeRequest) {
      return NextResponse.json(
        { error: "Merge request context is required." },
        { status: 400 },
      );
    }

    const retrieval =
      body.retrieval ?? (await collectRetrievalContext(body.mergeRequest));

    const payload = buildAiCenterReviewDebugPayload({
      mergeRequest: body.mergeRequest,
      jiraIssue: body.jiraIssue,
      retrieval,
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      payload,
      retrieval,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build review payload.",
      },
      { status: 500 },
    );
  }
}
