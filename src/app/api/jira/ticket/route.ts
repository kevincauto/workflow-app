import { NextResponse } from "next/server";

import { extractJiraKeyFromInput, getJiraTicketByKey } from "@/lib/jira";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const key = extractJiraKeyFromInput(body.url ?? "");

    if (!key) {
      return NextResponse.json(
        { error: "Enter a Jira ticket URL or key, for example CP2-2076." },
        { status: 400 },
      );
    }

    const ticket = await getJiraTicketByKey(key);
    return NextResponse.json({ ticket });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load that Jira ticket.",
      },
      { status: 500 },
    );
  }
}
