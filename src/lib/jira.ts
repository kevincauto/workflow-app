import { mockJiraIssue } from "@/lib/mockData";
import type {
  JiraCandidate,
  JiraImageAttachment,
  JiraIssue,
  JiraSprintInfo,
  JiraTicketOption,
  ListAssignedJiraTicketsResponse,
} from "@/lib/types";

const jiraKeyPattern = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const jiraSourcePriority: Record<JiraCandidate["source"], number> = {
  branch: 0,
  title: 1,
  description: 2,
};

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

  const bestCandidates = new Map<string, JiraCandidate>();

  for (const candidate of candidates) {
    const existingCandidate = bestCandidates.get(candidate.key);

    if (
      !existingCandidate ||
      jiraSourcePriority[candidate.source] <
        jiraSourcePriority[existingCandidate.source]
    ) {
      bestCandidates.set(candidate.key, candidate);
    }
  }

  return Array.from(bestCandidates.values()).sort(
    (left, right) =>
      jiraSourcePriority[left.source] - jiraSourcePriority[right.source],
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

function getJiraBaseUrl() {
  const baseUrl = process.env.JIRA_BASE_URL;
  if (!baseUrl) {
    throw new Error("JIRA_BASE_URL is not configured.");
  }

  return baseUrl.replace(/\/+$/, "");
}

function getJiraIssueWebUrl(key: string) {
  return `${getJiraBaseUrl()}/browse/${encodeURIComponent(key)}`;
}

function getMockJiraIssue(key: string): JiraIssue {
  return {
    ...mockJiraIssue,
    key,
    webUrl: mockJiraIssue.webUrl.replace(
      /\/browse\/[^/]+$/,
      `/browse/${encodeURIComponent(key)}`,
    ),
  };
}

async function fetchJiraJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getJiraBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: buildJiraAuthHeader(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Jira request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function getMockAssignedTickets(): ListAssignedJiraTicketsResponse {
  return {
    tickets: [
      {
        ...mockJiraIssue,
        status: "Ready for Development",
        priority: "Medium",
        issueType: "Story",
        assignee: process.env.JIRA_ASSIGNEE_NAME || "Kevin Cauto",
        developer: process.env.JIRA_ASSIGNEE_NAME || "Kevin Cauto",
        estimatePoints: 3,
        updatedAt: new Date().toISOString(),
        sprint: {
          id: "mock-active-sprint",
          name: "Current Sprint",
          state: "active",
          startDate: null,
          endDate: null,
        },
        imageAttachments: [
          {
            id: "mock-ticket-image",
            filename: "jira-story-reference.svg",
            mimeType: "image/svg+xml",
            size: null,
          },
        ],
      },
    ],
    source: "mock",
    assignee: process.env.JIRA_ASSIGNEE_NAME || "Kevin Cauto",
    notices: ["Jira is not configured; showing mock assigned ticket data."],
  };
}

function escapeJqlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function quoteJqlField(fieldName: string) {
  return `"${escapeJqlString(fieldName)}"`;
}

function getDeveloperJqlField() {
  return process.env.JIRA_DEVELOPER_FIELD_NAME?.trim() || "Developer";
}

function getDeveloperFieldId() {
  return process.env.JIRA_DEVELOPER_FIELD_ID?.trim() || null;
}

function getEstimateFieldId() {
  return process.env.JIRA_ESTIMATE_FIELD_ID?.trim() || "customfield_10016";
}

function getConfiguredEstimateFieldIds() {
  return getEstimateFieldId()
    .split(",")
    .map((fieldId) => fieldId.trim())
    .filter(Boolean);
}

function getConfiguredAssignee() {
  const accountId = process.env.JIRA_ASSIGNEE_ACCOUNT_ID?.trim();
  const name = process.env.JIRA_ASSIGNEE_NAME?.trim() || "Kevin Cauto";

  return {
    jqlValue: accountId || name,
    displayName: name,
  };
}

interface JiraSprintPayload {
  id: number;
  name: string;
  state?: string;
  startDate?: string;
  endDate?: string;
}

interface JiraSprintPagePayload {
  startAt?: number;
  maxResults?: number;
  total?: number;
  isLast?: boolean;
  values?: JiraSprintPayload[];
}

function normalizeSprint(payload: JiraSprintPayload): JiraSprintInfo {
  const state = payload.state?.toLowerCase();

  return {
    id: String(payload.id),
    name: payload.name,
    state:
      state === "active" || state === "future" || state === "closed"
        ? state
        : "unknown",
    startDate: payload.startDate ?? null,
    endDate: payload.endDate ?? null,
  };
}

async function listBoardSprints() {
  const boardId = process.env.JIRA_BOARD_ID?.trim();
  if (!boardId) {
    return {
      sprints: [] as JiraSprintInfo[],
      notices: [
        "JIRA_BOARD_ID is not configured; ticket ordering falls back to updated date.",
      ],
    };
  }

  const sprints: JiraSprintInfo[] = [];
  const notices: string[] = [];
  let startAt = 0;
  let isLast = false;

  while (!isLast) {
    const payload = await fetchJiraJson<JiraSprintPagePayload>(
      `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?state=active,future&startAt=${startAt}&maxResults=50`,
    );

    sprints.push(...(payload.values ?? []).map(normalizeSprint));
    isLast = payload.isLast ?? sprints.length >= (payload.total ?? 0);
    startAt += payload.maxResults ?? 50;

    if (!payload.values?.length) {
      break;
    }
  }

  if (sprints.length === 0) {
    notices.push(
      "No active or future Jira sprints were returned for JIRA_BOARD_ID.",
    );
  }

  return { sprints, notices };
}

type JiraFieldMap = Record<string, unknown>;

interface JiraSearchIssuePayload {
  key: string;
  fields?: JiraFieldMap;
}

interface JiraSearchPayload {
  issues?: JiraSearchIssuePayload[];
}

interface JiraAttachmentPayload {
  id?: string | number;
  filename?: string;
  mimeType?: string;
  size?: number;
  content?: string;
}

interface JiraFieldPayload {
  id?: string;
  name?: string;
  schema?: {
    custom?: string;
  };
}

function getFieldName(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const field = value as { name?: unknown; displayName?: unknown };
  return typeof field.name === "string"
    ? field.name
    : typeof field.displayName === "string"
      ? field.displayName
      : null;
}

function getFieldString(value: unknown) {
  return typeof value === "string" ? value : getFieldName(value);
}

function getFieldNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeImageAttachments(value: unknown): JiraImageAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const attachment = item as JiraAttachmentPayload;
    const id = attachment.id === undefined ? "" : String(attachment.id);
    const mimeType = attachment.mimeType?.trim() ?? "";

    if (!id || !attachment.filename || !mimeType.startsWith("image/")) {
      return [];
    }

    return [
      {
        id,
        filename: attachment.filename,
        mimeType,
        size: typeof attachment.size === "number" ? attachment.size : null,
      },
    ];
  });
}

function normalizeFieldName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isEstimateField(field: JiraFieldPayload) {
  const fieldName = field.name ? normalizeFieldName(field.name) : "";
  const customSchema = field.schema?.custom?.toLowerCase() ?? "";

  return (
    [
      "story points",
      "story point estimate",
      "story point estimates",
      "estimate points",
      "points",
    ].includes(fieldName) || customSchema.includes("storypoints")
  );
}

async function listEstimateFieldIds() {
  const configuredFieldIds = getConfiguredEstimateFieldIds();
  let discoveredFieldIds: string[] = [];

  for (const version of getJiraApiVersions()) {
    try {
      const fields = await fetchJiraJson<JiraFieldPayload[]>(
        `/rest/api/${version}/field`,
      );
      discoveredFieldIds = fields
        .filter((field) => field.id && isEstimateField(field))
        .map((field) => field.id as string);
      break;
    } catch {
      discoveredFieldIds = [];
    }
  }

  return Array.from(new Set([...configuredFieldIds, ...discoveredFieldIds]));
}

function getIssueEstimatePoints(
  fields: JiraFieldMap,
  estimateFieldIds: string[],
) {
  for (const fieldId of estimateFieldIds) {
    const estimatePoints = getFieldNumber(fields[fieldId]);

    if (estimatePoints !== null) {
      return estimatePoints;
    }
  }

  return null;
}

function parseSprintString(value: string): JiraSprintInfo | null {
  const id = value.match(/id=([^,\]]+)/)?.[1]?.trim();
  const name = value.match(/name=([^,\]]+)/)?.[1]?.trim();
  const state = value
    .match(/state=([^,\]]+)/)?.[1]
    ?.trim()
    .toLowerCase();

  if (!id && !name) {
    return null;
  }

  return {
    id: id ?? name ?? "unknown-sprint",
    name: name ?? id ?? "Unknown sprint",
    state:
      state === "active" || state === "future" || state === "closed"
        ? state
        : "unknown",
    startDate: null,
    endDate: null,
  };
}

function normalizeIssueSprint(value: unknown): JiraSprintInfo | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const sprint = normalizeIssueSprint(item);
      if (sprint) {
        return sprint;
      }
    }

    return null;
  }

  if (typeof value === "string") {
    return parseSprintString(value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const sprint = value as {
    id?: unknown;
    name?: unknown;
    state?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  };
  const id =
    typeof sprint.id === "number" || typeof sprint.id === "string"
      ? String(sprint.id)
      : null;
  const name = typeof sprint.name === "string" ? sprint.name : null;
  const state =
    typeof sprint.state === "string" ? sprint.state.toLowerCase() : null;

  if (!id && !name) {
    return null;
  }

  return {
    id: id ?? name ?? "unknown-sprint",
    name: name ?? id ?? "Unknown sprint",
    state:
      state === "active" || state === "future" || state === "closed"
        ? state
        : "unknown",
    startDate: typeof sprint.startDate === "string" ? sprint.startDate : null,
    endDate: typeof sprint.endDate === "string" ? sprint.endDate : null,
  };
}

function getIssueSprint(
  fields: JiraFieldMap,
  sprintById: Map<string, JiraSprintInfo>,
) {
  const sprintFieldId = process.env.JIRA_SPRINT_FIELD_ID || "customfield_10020";
  const configuredSprint = normalizeIssueSprint(fields[sprintFieldId]);

  if (configuredSprint) {
    return sprintById.get(configuredSprint.id) ?? configuredSprint;
  }

  for (const value of Object.values(fields)) {
    const sprint = normalizeIssueSprint(value);

    if (sprint && sprintById.has(sprint.id)) {
      return sprintById.get(sprint.id) ?? sprint;
    }
  }

  return null;
}

function mapSearchIssue(
  issue: JiraSearchIssuePayload,
  sprintById: Map<string, JiraSprintInfo>,
  estimateFieldIds: string[],
): JiraTicketOption {
  const fields = issue.fields ?? {};
  const developerFieldName = getDeveloperJqlField();
  const developerFieldId = getDeveloperFieldId();
  const developer = developerFieldId
    ? getFieldString(fields[developerFieldId])
    : getFieldString(fields[developerFieldName]);
  const estimatePoints = getIssueEstimatePoints(fields, estimateFieldIds);

  return {
    key: issue.key,
    summary: getFieldString(fields.summary) ?? issue.key,
    description:
      flattenJiraDescription(fields.description) ||
      "No Jira description available.",
    webUrl: getJiraIssueWebUrl(issue.key),
    source: "live",
    status: getFieldString(fields.status),
    priority: getFieldString(fields.priority),
    issueType: getFieldString(fields.issuetype),
    assignee: getFieldString(fields.assignee),
    developer,
    estimatePoints,
    updatedAt: typeof fields.updated === "string" ? fields.updated : null,
    sprint: getIssueSprint(fields, sprintById),
    imageAttachments: normalizeImageAttachments(fields.attachment),
  };
}

function getSprintSortValue(sprint: JiraSprintInfo | null) {
  if (!sprint) {
    return 3;
  }

  if (sprint.state === "active") {
    return 0;
  }

  if (sprint.state === "future") {
    return 1;
  }

  return 2;
}

function sortTicketsBySprint(left: JiraTicketOption, right: JiraTicketOption) {
  const sprintSort =
    getSprintSortValue(left.sprint) - getSprintSortValue(right.sprint);

  if (sprintSort !== 0) {
    return sprintSort;
  }

  const leftStart = left.sprint?.startDate ?? left.sprint?.endDate ?? "";
  const rightStart = right.sprint?.startDate ?? right.sprint?.endDate ?? "";

  if (leftStart !== rightStart) {
    return leftStart.localeCompare(rightStart);
  }

  return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
}

export async function listAssignedJiraTickets(): Promise<ListAssignedJiraTicketsResponse> {
  if (!isJiraConfigured()) {
    return getMockAssignedTickets();
  }

  const { jqlValue, displayName } = getConfiguredAssignee();
  const { sprints, notices } = await listBoardSprints();
  const estimateFieldIds = await listEstimateFieldIds();
  const sprintById = new Map(sprints.map((sprint) => [sprint.id, sprint]));
  const sprintClause = sprints.length
    ? ` AND sprint in (${sprints.map((sprint) => sprint.id).join(",")})`
    : "";
  const developerField = quoteJqlField(getDeveloperJqlField());
  const ownerClause = `("assignee" = "${escapeJqlString(jqlValue)}" OR ${developerField} = "${escapeJqlString(jqlValue)}")`;
  const jql =
    [ownerClause, "resolution = Unresolved"].join(" AND ") +
    sprintClause +
    " ORDER BY updated DESC";
  const fields = [
    "summary",
    "description",
    "status",
    "priority",
    "issuetype",
    "assignee",
    getDeveloperFieldId() ?? getDeveloperJqlField(),
    ...estimateFieldIds,
    "updated",
    "attachment",
    process.env.JIRA_SPRINT_FIELD_ID || "customfield_10020",
  ];
  let response: JiraSearchPayload | null = null;
  let lastError: Error | null = null;

  for (const version of getJiraApiVersions()) {
    try {
      response = await fetchJiraJson<JiraSearchPayload>(
        `/rest/api/${version}/search`,
        {
          method: "POST",
          body: JSON.stringify({
            jql,
            maxResults: 50,
            fields: Array.from(new Set(fields)),
          }),
        },
      );
      break;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Jira search failed.");
    }
  }

  if (!response) {
    throw lastError ?? new Error("Unable to list assigned Jira tickets.");
  }

  return {
    tickets: (response.issues ?? [])
      .map((issue) => mapSearchIssue(issue, sprintById, estimateFieldIds))
      .sort(sortTicketsBySprint),
    source: "live",
    assignee: displayName,
    notices,
  };
}

export async function getJiraImageAttachmentContent(
  ticketKey: string,
  attachmentId: string,
) {
  if (!isJiraConfigured()) {
    if (
      ticketKey !== mockJiraIssue.key ||
      attachmentId !== "mock-ticket-image"
    ) {
      throw new Error("Jira image attachment was not found.");
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><rect width="1200" height="720" fill="#07111f"/><rect x="90" y="90" width="1020" height="540" rx="32" fill="#12343b" stroke="#67e8f9" stroke-width="6"/><text x="600" y="330" text-anchor="middle" font-family="sans-serif" font-size="54" fill="#f8fafc">Jira Story Reference</text><text x="600" y="410" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#fdba74">Mock attached image</text></svg>`;

    return {
      data: new TextEncoder().encode(svg),
      filename: "jira-story-reference.svg",
      mimeType: "image/svg+xml",
    };
  }

  let payload: { fields?: { attachment?: JiraAttachmentPayload[] } } | null =
    null;
  let lastError: Error | null = null;

  for (const version of getJiraApiVersions()) {
    try {
      payload = await fetchJiraJson(
        `/rest/api/${version}/issue/${encodeURIComponent(ticketKey)}?fields=attachment`,
      );
      break;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Unable to load Jira attachments.");
    }
  }

  if (!payload) {
    throw lastError ?? new Error("Unable to load Jira attachments.");
  }

  const attachment = payload.fields?.attachment?.find(
    (candidate) => String(candidate.id) === attachmentId,
  );

  if (
    !attachment?.content ||
    !attachment.filename ||
    !attachment.mimeType?.startsWith("image/")
  ) {
    throw new Error("Jira image attachment was not found.");
  }

  const contentUrl = new URL(attachment.content, getJiraBaseUrl());
  const jiraUrl = new URL(getJiraBaseUrl());

  if (contentUrl.origin !== jiraUrl.origin) {
    throw new Error("Jira returned an invalid attachment URL.");
  }

  const response = await fetch(contentUrl, {
    headers: {
      Accept: attachment.mimeType,
      Authorization: buildJiraAuthHeader(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Jira attachment download failed with status ${response.status}.`,
    );
  }

  return {
    data: new Uint8Array(await response.arrayBuffer()),
    filename: attachment.filename,
    mimeType: attachment.mimeType,
  };
}

export async function resolveJiraIssue(key: string): Promise<JiraIssue> {
  if (!isJiraConfigured()) {
    return getMockJiraIssue(key);
  }

  const authHeader = buildJiraAuthHeader();
  let response: Response | null = null;
  let lastStatus: number | null = null;

  for (const version of getJiraApiVersions()) {
    response = await fetch(
      `${getJiraBaseUrl()}/rest/api/${version}/issue/${encodeURIComponent(key)}?fields=summary,description`,
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
    webUrl: getJiraIssueWebUrl(payload.key),
    source: "live",
  };
}
