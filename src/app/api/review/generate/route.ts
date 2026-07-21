import { NextResponse } from "next/server";

import { AiReviewUnavailableError, generateReview } from "@/lib/ai";
import { collectRetrievalContext } from "@/lib/retrieval";
import type { ReviewRequestPayload } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReviewRequestPayload;
    if (!body.mergeRequest) {
      return NextResponse.json(
        { error: "Merge request context is required." },
        { status: 400 },
      );
    }

    const retrieval = await collectRetrievalContext(body.mergeRequest);
    const review = await generateReview({
      mergeRequest: body.mergeRequest,
      jiraIssue: body.jiraIssue,
      retrieval,
    });

    return NextResponse.json(review);
  } catch (error) {
    const status = error instanceof AiReviewUnavailableError ? 503 : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to generate review.",
      },
      { status },
    );
  }
}
