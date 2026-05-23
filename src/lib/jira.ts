import { mockJiraIssue } from "@/lib/mockData";
import type { JiraCandidate, JiraIssue } from "@/lib/types";

const jiraKeyPattern = /\b[A-Z][A-Z0-9]+-\d+\b/g;

function collectMatches(input: string, source: JiraCandidate["source"]) {
  const matches = input.match(jiraKeyPattern) ?? [];

  return matches.map((key) => ({ key, source }));
}

export function extractJiraKeys(fields: {
  title: string;
  description: string;
  sourceBranch: string;
}): JiraCandidate[] {
  const candidates = [
    ...collectMatches(fields.title, "title"),
    ...collectMatches(fields.description, "description"),
    ...collectMatches(fields.sourceBranch, "branch"),
  ];

  return Array.from(
    new Map(candidates.map((candidate) => [candidate.key, candidate])).values(),
  );
}

function flattenJiraDescription(node: unknown): string {
  if (typeof node === "string") {
    return node;
  }

  if (!node || typeof node !== "object") {
    return "";
  }

  const value = node as {
    type?: string;
    text?: string;
    content?: unknown[];
  };

  if (value.type === "text") {
    return value.text ?? "";
  }

  const children = Array.isArray(value.content)
    ? value.content.map(flattenJiraDescription).filter(Boolean)
    : [];

  const separator = value.type === "paragraph" ? "\n" : " ";
  return children.join(separator).trim();
}

type JiraAuthMode = "auto" | "bearer" | "basic";

function isJiraConfigured() {
  return Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_API_TOKEN);
}

function getJiraAuthMode(): JiraAuthMode {
  const mode = process.env.JIRA_AUTH_MODE?.toLowerCase();

  if (mode === "basic" || mode === "bearer") {
    return mode;
  }

  return "auto";
}

function buildJiraAuthHeader() {
  const token = process.env.JIRA_API_TOKEN;
  if (!token) {
    throw new Error("JIRA_API_TOKEN is not configured.");
  }

  const authMode = getJiraAuthMode();
  const jiraIdentity = process.env.JIRA_EMAIL || process.env.JIRA_USERNAME;
  const useBasic =
    authMode === "basic" || (authMode === "auto" && Boolean(jiraIdentity));

  if (useBasic) {
    if (!jiraIdentity) {
      throw new Error(
        "JIRA_EMAIL or JIRA_USERNAME is required for basic Jira auth.",
      );
    }

    const auth = Buffer.from(`${jiraIdentity}:${token}`).toString("base64");
    return `Basic ${auth}`;
  }

  return `Bearer ${token}`;
}

function getJiraApiVersions() {
  const configured = process.env.JIRA_API_VERSION?.trim();
  const candidates = configured
    ? [configured, "2", "3", "latest"]
    : ["2", "3", "latest"];

  return Array.from(new Set(candidates));
}

export async function resolveJiraIssue(key: string): Promise<JiraIssue> {
  if (!isJiraConfigured()) {
    return { ...mockJiraIssue, key };
  }

  const authHeader = buildJiraAuthHeader();
  let response: Response | null = null;
  let lastStatus: number | null = null;

  for (const version of getJiraApiVersions()) {
    response = await fetch(
      `${process.env.JIRA_BASE_URL}/rest/api/${version}/issue/${encodeURIComponent(key)}?fields=summary,description`,
      {
        headers: {
          Accept: "application/json",
          Authorization: authHeader,
        },
        cache: "no-store",
      },
    );

    if (response.ok) {
      break;
    }

    lastStatus = response.status;
    if (![404, 405].includes(response.status)) {
      break;
    }
  }

  if (!response?.ok) {
    throw new Error(
      `Jira lookup failed with status ${lastStatus ?? response?.status ?? "unknown"}`,
    );
  }

  const payload = (await response.json()) as {
    key: string;
    fields?: {
      summary?: string;
      description?: unknown;
    };
  };

  return {
    key: payload.key,
    summary: payload.fields?.summary ?? key,
    description:
      flattenJiraDescription(payload.fields?.description) ||
      "No Jira description available.",
    source: "live",
  };
}
