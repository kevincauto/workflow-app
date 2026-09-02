import { NextResponse } from "next/server";

import { listJiraAttachments } from "@/lib/jira";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ ticketKey: string }>;
  },
) {
  try {
    const { ticketKey } = await params;
    const attachments = await listJiraAttachments(ticketKey);

    return NextResponse.json({ attachments });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Jira attachments.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("not found") ? 404 : 502 },
    );
  }
}
