import { NextResponse } from "next/server";

import { extractFigmaContext } from "@/lib/figma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url?.trim()) {
      return NextResponse.json(
        { error: "Figma URL is required." },
        { status: 400 },
      );
    }

    const figma = await extractFigmaContext(body.url.trim());
    return NextResponse.json({ figma });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to extract Figma context.",
      },
      { status: 500 },
    );
  }
}
