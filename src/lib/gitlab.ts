import { getCommentBody } from "@/lib/lineMapping";
import { mockMergeRequest } from "@/lib/mockData";
import {
  buildRepositoryContext,
  REPOSITORY_METADATA_FILE_PATHS,
  type RepositoryMetadataFiles,
} from "@/lib/repositoryContext";
import type {
  ChangedFile,
  MergeRequestContext,
  OpenMergeRequestOption,
  PostResult,
  ReviewFinding,
} from "@/lib/types";

interface ParsedMergeRequestUrl {
  host: string;
  projectPath: string;
  iid: string;
}

type GitLabAuthMode = "auto" | "private-token" | "bearer";

interface GitLabChangeEntry {
  old_path: string;
  new_path: string;
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  generated_file?: boolean;
  collapsed?: boolean;
  too_large?: boolean;
}

interface GitLabOpenMergeRequestEntry {
  iid: number;
  title: string;
  web_url: string;
  source_branch: string;
  target_branch: string;
  updated_at: string;
  author?: { name?: string };
}

interface FileContentResult {
  content: string;
  status: "available" | "unavailable";
  error: string | null;
}

function getGitLabApiBase(host: string) {
  return process.env.GITLAB_API_BASE_URL || `${host}/api/v4`;
}

export function parseMergeRequestUrl(url: string): ParsedMergeRequestUrl {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid merge request URL.");
  }

  const match = parsed.pathname.match(/^(.*)\/-\/merge_requests\/(\d+)\/?$/);
  if (!match) {
    throw new Error(
      "Expected a GitLab merge request URL ending in /-/merge_requests/:iid.",
    );
  }

  return {
    host: parsed.origin,
    projectPath: match[1].replace(/^\//, ""),
    iid: match[2],
  };
}

function isGitLabConfigured() {
  return Boolean(process.env.GITLAB_TOKEN);
}

function getGitLabAuthMode(): GitLabAuthMode {
  const mode = process.env.GITLAB_AUTH_MODE?.toLowerCase();

  if (mode === "private-token" || mode === "bearer") {
    return mode;
  }

  return "auto";
}

function getGitLabHeaders(
  mode: Exclude<GitLabAuthMode, "auto">,
  initHeaders?: HeadersInit,
) {
  const token = process.env.GITLAB_TOKEN;
  const headers = new Headers(initHeaders);

  headers.set("Accept", "application/json");

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!token) {
    return headers;
  }

  if (mode === "bearer") {
    headers.set("Authorization", `Bearer ${token}`);
    return headers;
  }

  headers.set("Private-Token", token);
  return headers;
}

function getGitLabAuthAttempts() {
  const configured = getGitLabAuthMode();

  if (configured === "private-token") {
    return ["private-token", "bearer"] as const;
  }

  if (configured === "bearer") {
    return ["bearer", "private-token"] as const;
  }

  return ["private-token", "bearer"] as const;
}

async function fetchGitLab<T>(
  host: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response | null = null;
  const attemptedModes: string[] = [];

  for (const mode of getGitLabAuthAttempts()) {
    attemptedModes.push(mode);
    response = await fetch(`${getGitLabApiBase(host)}${path}`, {
      ...init,
      headers: getGitLabHeaders(mode, init?.headers),
      cache: "no-store",
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status !== 401) {
      break;
    }
  }

  throw new Error(
    `GitLab request failed with status ${response?.status ?? "unknown"} after trying auth modes: ${attemptedModes.join(", ")}`,
  );
}

async function fetchGitLabPages<T>(host: string, path: string): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    let response: Response | null = null;
    const attemptedModes: string[] = [];
    const pageSeparator = path.includes("?") ? "&" : "?";

    for (const mode of getGitLabAuthAttempts()) {
      attemptedModes.push(mode);
      response = await fetch(
        `${getGitLabApiBase(host)}${path}${pageSeparator}page=${page}`,
        {
          headers: getGitLabHeaders(mode),
          cache: "no-store",
        },
      );

      if (response.ok) {
        results.push(...((await response.json()) as T[]));
        hasNextPage = Boolean(response.headers.get("x-next-page"));
        page += 1;
        break;
      }

      if (response.status !== 401) {
        break;
      }
    }

    if (!response?.ok) {
      throw new Error(
        `GitLab request failed with status ${response?.status ?? "unknown"} after trying auth modes: ${attemptedModes.join(", ")}`,
      );
    }
  }

  return results;
}

function getProjectInfoFromMergeRequestUrl(webUrl: string) {
  try {
    const parsed = parseMergeRequestUrl(webUrl);

    return {
      projectPath: parsed.projectPath,
      projectName: parsed.projectPath.split("/").pop() || parsed.projectPath,
    };
  } catch {
    return {
      projectPath: "Unknown project",
      projectName: "Unknown project",
    };
  }
}

function toOpenMergeRequestOption(
  mergeRequest: GitLabOpenMergeRequestEntry,
): OpenMergeRequestOption {
  const projectInfo = getProjectInfoFromMergeRequestUrl(mergeRequest.web_url);

  return {
    iid: String(mergeRequest.iid),
    title: mergeRequest.title,
    webUrl: mergeRequest.web_url,
    projectPath: projectInfo.projectPath,
    projectName: projectInfo.projectName,
    sourceBranch: mergeRequest.source_branch,
    targetBranch: mergeRequest.target_branch,
    author: mergeRequest.author?.name || "Unknown",
    updatedAt: mergeRequest.updated_at,
  };
}

function isMissingOrForbiddenGitLabResource(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("status 403") || error.message.includes("status 404")
  );
}

async function listGroupOpenMergeRequests(input: {
  host: string;
  groupIdOrPath: string;
}) {
  const mergeRequests = await fetchGitLabPages<GitLabOpenMergeRequestEntry>(
    input.host,
    `/groups/${encodeURIComponent(input.groupIdOrPath)}/merge_requests?state=opened&scope=all&include_subgroups=true&order_by=updated_at&sort=desc&per_page=100`,
  );

  return mergeRequests.map(toOpenMergeRequestOption);
}

async function listProjectOpenMergeRequests(input: {
  host: string;
  projectIdOrPath: string;
}) {
  const mergeRequests = await fetchGitLabPages<GitLabOpenMergeRequestEntry>(
    input.host,
    `/projects/${encodeURIComponent(input.projectIdOrPath)}/merge_requests?state=opened&scope=all&order_by=updated_at&sort=desc&per_page=100`,
  );

  return mergeRequests.map(toOpenMergeRequestOption);
}

async function fetchFileContent(
  host: string,
  projectIdOrPath: string,
  filePath: string,
  ref: string,
): Promise<FileContentResult> {
  const encodedProject = encodeURIComponent(projectIdOrPath);
  const encodedPath = encodeURIComponent(filePath);

  for (const mode of getGitLabAuthAttempts()) {
    const response = await fetch(
      `${getGitLabApiBase(host)}/projects/${encodedProject}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(ref)}`,
      {
        headers: getGitLabHeaders(mode),
        cache: "no-store",
      },
    );

    if (response.ok) {
      return {
        content: await response.text(),
        status: "available",
        error: null,
      };
    }

    if (response.status !== 401) {
      return {
        content: "",
        status: "unavailable",
        error: `GitLab file fetch failed with status ${response.status}.`,
      };
    }
  }

  return {
    content: "",
    status: "unavailable",
    error: "GitLab file fetch failed with status 401.",
  };
}

function inferLanguage(filePath: string) {
  return filePath.split(".").pop() || "txt";
}

async function loadChangedFiles(input: {
  host: string;
  projectIdOrPath: string;
  sourceBranch: string;
  changes: GitLabChangeEntry[];
}): Promise<ChangedFile[]> {
  return Promise.all(
    input.changes.map(async (change) => {
      const fileContent = change.deleted_file
        ? {
            content: "",
            status: "deleted" as const,
            error: null,
          }
        : await fetchFileContent(
            input.host,
            input.projectIdOrPath,
            change.new_path,
            input.sourceBranch,
          );

      return {
        oldPath: change.old_path,
        newPath: change.new_path,
        diff: change.diff,
        content: fileContent.content,
        contentStatus: fileContent.status,
        contentError: fileContent.error,
        language: inferLanguage(change.new_path),
        isDeleted: change.deleted_file,
        isNew: change.new_file,
        isRenamed: change.renamed_file,
        isGenerated: Boolean(change.generated_file),
        diffCollapsed: Boolean(change.collapsed),
        diffTooLarge: Boolean(change.too_large),
      };
    }),
  );
}

async function loadRepositoryMetadataFiles(input: {
  host: string;
  projectIdOrPath: string;
  sourceBranch: string;
}): Promise<RepositoryMetadataFiles> {
  const entries = await Promise.all(
    REPOSITORY_METADATA_FILE_PATHS.map(async (filePath) => {
      const fileContent = await fetchFileContent(
        input.host,
        input.projectIdOrPath,
        filePath,
        input.sourceBranch,
      );

      return [
        filePath,
        fileContent.status === "available" ? fileContent.content : null,
      ] as const;
    }),
  );

  return Object.fromEntries(entries) as RepositoryMetadataFiles;
}

export async function loadMergeRequest(
  url: string,
): Promise<MergeRequestContext> {
  const parsed = parseMergeRequestUrl(url);

  if (!isGitLabConfigured()) {
    return {
      ...mockMergeRequest,
      webUrl: url,
    };
  }

  const projectIdOrPath = parsed.projectPath;

  const [mergeRequest, changesResponse, versionsResponse] = await Promise.all([
    fetchGitLab<{
      iid: number;
      title: string;
      description: string;
      source_branch: string;
      target_branch: string;
      web_url: string;
      author?: { name?: string };
      references?: { full?: string };
      diff_refs?: {
        base_sha?: string;
        head_sha?: string;
        start_sha?: string;
      };
    }>(
      parsed.host,
      `/projects/${encodeURIComponent(projectIdOrPath)}/merge_requests/${parsed.iid}`,
    ),
    fetchGitLab<{
      changes: GitLabChangeEntry[];
      overflow?: boolean;
    }>(
      parsed.host,
      `/projects/${encodeURIComponent(projectIdOrPath)}/merge_requests/${parsed.iid}/changes?access_raw_diffs=true&unidiff=true`,
    ),
    fetchGitLab<
      Array<{
        id: number;
        base_commit_sha?: string;
        head_commit_sha?: string;
        start_commit_sha?: string;
      }>
    >(
      parsed.host,
      `/projects/${encodeURIComponent(projectIdOrPath)}/merge_requests/${parsed.iid}/versions`,
    ),
  ]);

  const latestVersion = versionsResponse[0];
  const versionDiffResponse = latestVersion?.id
    ? await fetchGitLab<{
        diffs: GitLabChangeEntry[];
        state?: string;
      }>(
        parsed.host,
        `/projects/${encodeURIComponent(projectIdOrPath)}/merge_requests/${parsed.iid}/versions/${latestVersion.id}?unidiff=true`,
      )
    : null;

  const effectiveChanges = versionDiffResponse?.diffs?.length
    ? versionDiffResponse.diffs
    : changesResponse.changes;

  const changedFiles = await loadChangedFiles({
    host: parsed.host,
    projectIdOrPath,
    sourceBranch: mergeRequest.source_branch,
    changes: effectiveChanges,
  });
  const repositoryMetadataFiles = await loadRepositoryMetadataFiles({
    host: parsed.host,
    projectIdOrPath,
    sourceBranch: mergeRequest.source_branch,
  });
  const repositoryContext = buildRepositoryContext({
    metadataFiles: repositoryMetadataFiles,
    changedFiles,
  });

  return {
    source: "live",
    projectId: String(projectIdOrPath),
    projectPath: parsed.projectPath,
    projectName: parsed.projectPath.split("/").pop() || parsed.projectPath,
    webUrl: mergeRequest.web_url,
    iid: String(mergeRequest.iid),
    title: mergeRequest.title,
    description: mergeRequest.description || "",
    author: mergeRequest.author?.name || "Unknown",
    sourceBranch: mergeRequest.source_branch,
    targetBranch: mergeRequest.target_branch,
    changedFiles,
    repositoryContext,
    diffRefs: {
      baseSha:
        mergeRequest.diff_refs?.base_sha ||
        latestVersion?.base_commit_sha ||
        null,
      headSha:
        mergeRequest.diff_refs?.head_sha ||
        latestVersion?.head_commit_sha ||
        null,
      startSha:
        mergeRequest.diff_refs?.start_sha ||
        latestVersion?.start_commit_sha ||
        null,
    },
  };
}

export async function listOpenMergeRequests(): Promise<
  OpenMergeRequestOption[]
> {
  if (!isGitLabConfigured()) {
    return [
      {
        iid: mockMergeRequest.iid,
        title: mockMergeRequest.title,
        webUrl: mockMergeRequest.webUrl,
        projectPath: mockMergeRequest.projectPath,
        projectName: mockMergeRequest.projectName,
        sourceBranch: mockMergeRequest.sourceBranch,
        targetBranch: mockMergeRequest.targetBranch,
        author: mockMergeRequest.author,
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  const apiBase = process.env.GITLAB_API_BASE_URL;
  if (!apiBase) {
    throw new Error(
      "GITLAB_API_BASE_URL is required to list open merge requests.",
    );
  }

  const host = new URL(apiBase).origin;
  const groupIdOrPath = process.env.GITLAB_GROUP_ID;

  if (groupIdOrPath) {
    return listGroupOpenMergeRequests({ host, groupIdOrPath });
  }

  const projectIdOrPath = process.env.GITLAB_PROJECT_ID;
  if (!projectIdOrPath) {
    throw new Error(
      "GITLAB_GROUP_ID or GITLAB_PROJECT_ID is required to list open merge requests.",
    );
  }

  try {
    return await listProjectOpenMergeRequests({ host, projectIdOrPath });
  } catch (error) {
    if (!isMissingOrForbiddenGitLabResource(error)) {
      throw error;
    }

    return listGroupOpenMergeRequests({
      host,
      groupIdOrPath: projectIdOrPath,
    });
  }
}

async function postInlineDiscussion(input: {
  mergeRequest: MergeRequestContext;
  finding: ReviewFinding;
}) {
  const parsed = parseMergeRequestUrl(input.mergeRequest.webUrl);
  const body = getCommentBody(input.finding);

  return fetchGitLab<unknown>(
    parsed.host,
    `/projects/${encodeURIComponent(input.mergeRequest.projectId)}/merge_requests/${input.mergeRequest.iid}/discussions`,
    {
      method: "POST",
      body: JSON.stringify({
        body,
        position: {
          position_type: "text",
          base_sha: input.mergeRequest.diffRefs.baseSha,
          head_sha: input.mergeRequest.diffRefs.headSha,
          start_sha: input.mergeRequest.diffRefs.startSha,
          new_path: input.finding.filePath,
          old_path: input.finding.filePath,
          new_line: input.finding.lineStart,
        },
      }),
    },
  );
}

async function postGeneralNote(input: {
  mergeRequest: MergeRequestContext;
  finding: ReviewFinding;
}) {
  const parsed = parseMergeRequestUrl(input.mergeRequest.webUrl);

  return fetchGitLab<unknown>(
    parsed.host,
    `/projects/${encodeURIComponent(input.mergeRequest.projectId)}/merge_requests/${input.mergeRequest.iid}/notes`,
    {
      method: "POST",
      body: JSON.stringify({
        body: getCommentBody(input.finding),
      }),
    },
  );
}

export async function postReviewComments(input: {
  mergeRequest: MergeRequestContext;
  findings: ReviewFinding[];
}): Promise<PostResult[]> {
  if (!isGitLabConfigured()) {
    return input.findings.map((finding) => ({
      findingId: finding.id,
      status: "posted",
      mode: finding.isGeneralComment ? "general" : "inline",
      detail: "Mock mode: comment recorded but not sent to GitLab.",
    }));
  }

  const results: PostResult[] = [];

  for (const finding of input.findings) {
    if (!finding.approved) {
      results.push({
        findingId: finding.id,
        status: "skipped",
        mode: finding.isGeneralComment ? "general" : "inline",
        detail: "Not approved.",
      });
      continue;
    }

    try {
      if (!finding.isGeneralComment && finding.filePath && finding.lineStart) {
        await postInlineDiscussion({
          mergeRequest: input.mergeRequest,
          finding,
        });
        results.push({
          findingId: finding.id,
          status: "posted",
          mode: "inline",
          detail: "Posted as an inline GitLab discussion.",
        });
        continue;
      }

      await postGeneralNote({ mergeRequest: input.mergeRequest, finding });
      results.push({
        findingId: finding.id,
        status: "posted",
        mode: "general",
        detail: "Posted as a general merge request note.",
      });
    } catch (error) {
      results.push({
        findingId: finding.id,
        status: "failed",
        mode: finding.isGeneralComment ? "general" : "inline",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown GitLab posting error.",
      });
    }
  }

  return results;
}

export async function fetchRepositoryFile(
  mergeRequest: MergeRequestContext,
  filePath: string,
): Promise<string | null> {
  if (mergeRequest.source !== "live") {
    return null;
  }

  const parsed = parseMergeRequestUrl(mergeRequest.webUrl);
  const content = await fetchFileContent(
    parsed.host,
    mergeRequest.projectId,
    filePath,
    mergeRequest.sourceBranch,
  );

  return content.status === "available" ? content.content : null;
}
