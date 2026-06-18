import { NextResponse } from "next/server";

import { loadMergeRequestComments } from "@/lib/gitlab";
import type { LoadMrCommentsResponse, MergeRequestContext } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mergeRequest?: MergeRequestContext;
    };

    if (!body.mergeRequest) {
      return NextResponse.json(
        { error: "Merge request context is required." },
        { status: 400 },
      );
    }

    const comments = await loadMergeRequestComments(body.mergeRequest);
    const response: LoadMrCommentsResponse = { comments };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load merge request comments.",
      },
      { status: 500 },
    );
  }
}
