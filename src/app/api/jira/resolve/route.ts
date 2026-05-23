import { NextResponse } from "next/server";

import { resolveJiraIssue } from "@/lib/jira";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { key?: string };
    if (!body.key) {
      return NextResponse.json(
        { error: "Jira key is required." },
        { status: 400 },
      );
    }

    const jiraIssue = await resolveJiraIssue(body.key);
    return NextResponse.json({ jiraIssue });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to resolve Jira issue.",
      },
      { status: 500 },
    );
  }
}
