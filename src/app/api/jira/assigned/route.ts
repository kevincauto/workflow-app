import { NextResponse } from "next/server";

import { listAssignedJiraTickets } from "@/lib/jira";

export async function GET() {
  try {
    const assignedTickets = await listAssignedJiraTickets();
    return NextResponse.json(assignedTickets);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to list assigned Jira tickets.",
      },
      { status: 500 },
    );
  }
}
