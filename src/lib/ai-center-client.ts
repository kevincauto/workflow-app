import crypto from "node:crypto";

export type AiCenterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AiCenterResponseFormat = {
  type: "text" | "json_object";
};

export interface AiCenterChatOptions {
  maxTokens?: number;
  temperature?: number;
  responseFormat?: AiCenterResponseFormat;
}

export interface AiCenterChatDebugPayload {
  endpoint: string;
  method: "POST";
  headers: Record<string, string>;
  body: ReturnType<typeof buildAiCenterChatRequestBody>;
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function buildChatPath(path: string, deployment?: string) {
  if (!deployment) {
    return path;
  }

  const encodedDeployment = encodeURIComponent(deployment);
  const trimmedPath = path.replace(/\/$/, "");

  if (path.includes("{deployment}")) {
    return path.replace("{deployment}", encodedDeployment);
  }

  if (trimmedPath.endsWith(`/${encodedDeployment}`)) {
    return trimmedPath;
  }

  return `${trimmedPath}/${encodedDeployment}`;
}

function getAiCenterConfig() {
  const hostUrl = process.env.AI_CENTER_HOST_URL;
  const apiKey = process.env.AI_CENTER_API_KEY;
  const apiSecret = process.env.AI_CENTER_API_SECRET;
  const chatPath = buildChatPath(
    process.env.AI_CENTER_CHAT_PATH || "/chat/completions",
    process.env.AI_CENTER_DEPLOYMENT,
  );

  if (!hostUrl) throw new Error("Missing AI_CENTER_HOST_URL");
  if (!apiKey) throw new Error("Missing AI_CENTER_API_KEY");
  if (!apiSecret) throw new Error("Missing AI_CENTER_API_SECRET");

  return {
    hostUrl,
    apiKey,
    apiSecret,
    chatPath,
    endpoint: joinUrl(hostUrl, chatPath),
  };
}

export function isAiCenterConfigured() {
  return Boolean(
    process.env.AI_CENTER_HOST_URL &&
    process.env.AI_CENTER_API_KEY &&
    process.env.AI_CENTER_API_SECRET,
  );
}

function buildAiCenterChatRequestBody(
  messages: AiCenterMessage[],
  options?: AiCenterChatOptions,
) {
  const model = process.env.AI_CENTER_MODEL;

  return {
    messages,
    frequency_penalty: 0,
    max_tokens: options?.maxTokens ?? 800,
    n: 1,
    presence_penalty: 0,
    response_format: options?.responseFormat ?? {
      type: "text" as const,
    },
    stream: false,
    temperature: options?.temperature ?? 0.7,
    top_p: 1,
    ...(model ? { model } : {}),
  };
}

export function buildAiCenterChatDebugPayload(
  messages: AiCenterMessage[],
  options?: AiCenterChatOptions,
): AiCenterChatDebugPayload {
  const hostUrl = process.env.AI_CENTER_HOST_URL || "[AI_CENTER_HOST_URL]";
  const chatPath = buildChatPath(
    process.env.AI_CENTER_CHAT_PATH || "/chat/completions",
    process.env.AI_CENTER_DEPLOYMENT,
  );

  return {
    endpoint: joinUrl(hostUrl, chatPath),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": "[REDACTED]",
      "Client-Request-Id": "[GENERATED_UUID]",
      Timestamp: "[GENERATED_UNIX_MS]",
      Authorization: "[REDACTED_HMAC_SHA256_BASE64]",
    },
    body: buildAiCenterChatRequestBody(messages, options),
  };
}

export async function callAiCenterChat(
  messages: AiCenterMessage[],
  options?: AiCenterChatOptions,
) {
  const { apiKey, apiSecret, endpoint } = getAiCenterConfig();
  const clientRequestId = crypto.randomUUID();
  const timestamp = Date.now().toString();
  const requestBody = buildAiCenterChatRequestBody(messages, options);
  const requestBodyString = JSON.stringify(requestBody);
  const signaturePayload =
    apiKey + clientRequestId + timestamp + requestBodyString;
  const authorization = crypto
    .createHmac("sha256", apiSecret)
    .update(signaturePayload)
    .digest("base64");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
      "Client-Request-Id": clientRequestId,
      Timestamp: timestamp,
      Authorization: authorization,
    },
    body: requestBodyString,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `AI Center request failed. Status: ${response.status}. Body: ${responseText}`,
    );
  }

  return JSON.parse(responseText) as unknown;
}
