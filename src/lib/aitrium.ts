import "server-only";

const AITRIUM_LLM_ENDPOINT = "/v2/conversations/completion";

interface AitriumCompletionInput {
  prompt: string;
  conversationId?: string | null;
}

export class AitriumError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AitriumError";
  }
}

function requireEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AitriumError(`Missing server environment variable: ${name}`, 500);
  }

  return value;
}

export function isAitriumConfigured() {
  return Boolean(
    process.env.AITRIUM_BASE_URL &&
    process.env.AITRIUM_API_TOKEN &&
    process.env.AITRIUM_PERSONA_ID &&
    process.env.AITRIUM_MODEL_ID,
  );
}

export function buildAitriumRequest(input: AitriumCompletionInput) {
  const baseUrl = requireEnvironmentVariable("AITRIUM_BASE_URL").replace(
    /\/$/,
    "",
  );

  return {
    endpoint: `${baseUrl}${AITRIUM_LLM_ENDPOINT}`,
    body: {
      prompt: input.prompt,
      conversation_id: input.conversationId ?? null,
      persona_id: requireEnvironmentVariable("AITRIUM_PERSONA_ID"),
      attachments: [],
      override_gpt_model_id: requireEnvironmentVariable("AITRIUM_MODEL_ID"),
      user_timezone:
        process.env.AITRIUM_USER_TIMEZONE?.trim() || "America/New_York",
      is_selected_contexts_locked: false,
      view_type: "chat",
      message_attachment_ids: [],
      has_image_attachments: false,
    },
  };
}

function errorForStatus(status: number) {
  if (status === 400) {
    return "Aitrium validation error";
  }
  if (status === 401) {
    return "Unauthorized: check Aitrium API token";
  }
  if (status === 403) {
    return "Forbidden: token does not have access";
  }
  if (status === 404) {
    return "Aitrium endpoint not found";
  }
  if (status >= 500) {
    return "Aitrium service error";
  }

  return `Aitrium request failed with status ${status}`;
}

export async function requestAitriumStream(input: AitriumCompletionInput) {
  const { endpoint, body } = buildAitriumRequest(input);
  const token = requireEnvironmentVariable("AITRIUM_API_TOKEN");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AitriumError(errorForStatus(response.status), response.status);
  }
  if (!response.body) {
    throw new AitriumError("Aitrium response did not include a body", 502);
  }

  return response;
}

function contentFromEvent(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const event = payload as {
    content?: unknown;
    text?: unknown;
    token?: unknown;
    delta?: { content?: unknown };
    message?: { content?: unknown };
    choices?: Array<{
      delta?: { content?: unknown };
      message?: { content?: unknown };
      text?: unknown;
    }>;
  };
  const content =
    event.content ??
    event.delta?.content ??
    event.choices?.[0]?.delta?.content ??
    event.choices?.[0]?.message?.content ??
    event.message?.content ??
    event.choices?.[0]?.text ??
    event.text ??
    event.token;

  return typeof content === "string" ? content : "";
}

export async function readAitriumCompletion(response: Response) {
  const eventStream = await response.text();
  const chunks: string[] = [];

  for (const line of eventStream.split(/\r?\n/)) {
    if (!line.startsWith("data:")) {
      continue;
    }

    const data = line.slice(5).trimStart();
    if (!data || data === "[DONE]") {
      continue;
    }

    try {
      chunks.push(contentFromEvent(JSON.parse(data)));
    } catch {
      chunks.push(data);
    }
  }

  const content = chunks.join("");
  if (!content) {
    throw new AitriumError("Aitrium response did not include content", 502);
  }

  return content;
}
