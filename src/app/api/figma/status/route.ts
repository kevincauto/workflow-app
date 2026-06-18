import { NextResponse } from "next/server";

import { getFigmaStatus } from "@/lib/figma";

export async function GET() {
  return NextResponse.json(getFigmaStatus());
}
