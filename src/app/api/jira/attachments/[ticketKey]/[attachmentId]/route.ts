import { getJiraAttachmentContent } from "@/lib/jira";

function contentDispositionFilename(filename: string) {
  const fallback = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ ticketKey: string; attachmentId: string }>;
  },
) {
  try {
    const { ticketKey, attachmentId } = await params;
    const attachment = await getJiraAttachmentContent(ticketKey, attachmentId);

    return new Response(attachment.data, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDispositionFilename(attachment.filename),
        "Content-Length": String(attachment.data.byteLength),
        "Content-Type": attachment.mimeType,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Jira attachment.";

    return Response.json(
      { error: message },
      { status: message.includes("not found") ? 404 : 502 },
    );
  }
}
