import { NextResponse } from "next/server";

import { listOpenMergeRequests, loadMergeRequest } from "@/lib/gitlab";
import { extractJiraKeys, resolveJiraIssue } from "@/lib/jira";
import type {
  ListOpenMergeRequestsResponse,
  LoadMrResponse,
} from "@/lib/types";

export async function GET() {
  try {
    const mergeRequests = await listOpenMergeRequests();
    const response: ListOpenMergeRequestsResponse = { mergeRequests };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to list open merge requests.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { mrUrl?: string };
    if (!body.mrUrl) {
      return NextResponse.json(
        { error: "Merge request URL is required." },
        { status: 400 },
      );
    }

    const mergeRequest = await loadMergeRequest(body.mrUrl);
    const jiraCandidates = extractJiraKeys({
      title: mergeRequest.title,
      description: mergeRequest.description,
      sourceBranch: mergeRequest.sourceBranch,
    });

    let jiraIssue = null;
    const notices: string[] = [];

    if (jiraCandidates.length === 1) {
      try {
        jiraIssue = await resolveJiraIssue(jiraCandidates[0].key);
      } catch (error) {
        notices.push(
          error instanceof Error
            ? error.message
            : "Jira context could not be loaded.",
        );
      }
    }

    if (jiraCandidates.length === 0) {
      notices.push(
        "No Jira key detected in the title, description, or source branch.",
      );
    }

    const response: LoadMrResponse = {
      mergeRequest,
      jiraCandidates,
      jiraIssue,
      notices,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load merge request.",
      },
      { status: 500 },
    );
  }
}
