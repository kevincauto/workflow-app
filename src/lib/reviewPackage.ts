import type { ChangedFile, JiraIssue, MergeRequestContext } from "@/lib/types";

export interface ReviewPackageInput {
  generatedAt: string;
  mergeRequest: MergeRequestContext;
  jiraIssue: JiraIssue | null;
}

interface ManifestChangedFile {
  oldPath: string;
  newPath: string;
  language: string;
  status: "added" | "deleted" | "renamed" | "modified";
  isGenerated: boolean;
  diffCollapsed: boolean;
  diffTooLarge: boolean;
}

function getFileStatus(file: ChangedFile): ManifestChangedFile["status"] {
  if (file.isNew) {
    return "added";
  }

  if (file.isDeleted) {
    return "deleted";
  }

  if (file.isRenamed) {
    return "renamed";
  }

  return "modified";
}

export function sanitizePackageName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function getReviewPackageFolderName(mergeRequest: MergeRequestContext) {
  const safeProject =
    sanitizePackageName(mergeRequest.projectName) || "merge-request";

  return `review-package-${safeProject}-mr-${mergeRequest.iid}`;
}

function countDiffLines(files: ChangedFile[]) {
  return files.reduce(
    (totals, file) => {
      for (const line of file.diff.split("\n")) {
        if (line.startsWith("+++") || line.startsWith("---")) {
          continue;
        }

        if (line.startsWith("+")) {
          totals.additions += 1;
        }

        if (line.startsWith("-")) {
          totals.deletions += 1;
        }
      }

      return totals;
    },
    { additions: 0, deletions: 0 },
  );
}

export function buildReviewPackageManifest(input: ReviewPackageInput) {
  const { mergeRequest, jiraIssue } = input;
  const diffStats = countDiffLines(mergeRequest.changedFiles);

  return {
    packageVersion: 1,
    generatedAt: input.generatedAt,
    intendedUse:
      "Code review context package for an IDE coding agent. Inspect live files when the branch is checked out; use changes.patch for exact diff hunks.",
    sourceSystems: {
      mergeRequest: "GitLab REST API",
      issue: jiraIssue ? "Jira REST API" : null,
    },
    mergeRequest: {
      source: mergeRequest.source,
      projectId: mergeRequest.projectId,
      projectPath: mergeRequest.projectPath,
      projectName: mergeRequest.projectName,
      iid: mergeRequest.iid,
      title: mergeRequest.title,
      webUrl: mergeRequest.webUrl,
      author: mergeRequest.author,
      sourceBranch: mergeRequest.sourceBranch,
      targetBranch: mergeRequest.targetBranch,
      diffRefs: mergeRequest.diffRefs,
    },
    issueLinks: {
      mergeRequest: mergeRequest.webUrl,
      jiraKey: jiraIssue?.key ?? null,
    },
    jiraIssue: jiraIssue
      ? {
          key: jiraIssue.key,
          summary: jiraIssue.summary,
          source: jiraIssue.source,
        }
      : null,
    changedFiles: mergeRequest.changedFiles.map<ManifestChangedFile>(
      (file) => ({
        oldPath: file.oldPath,
        newPath: file.newPath,
        language: file.language,
        status: getFileStatus(file),
        isGenerated: file.isGenerated,
        diffCollapsed: file.diffCollapsed,
        diffTooLarge: file.diffTooLarge,
      }),
    ),
    diffStats: {
      filesChanged: mergeRequest.changedFiles.length,
      additions: diffStats.additions,
      deletions: diffStats.deletions,
    },
    knownConstraints: [
      "Full file contents are intentionally excluded from this package.",
      "changes.patch contains GitLab-provided unified diff hunks and may omit context if GitLab marks a diff collapsed or too large.",
      "summary.md contains Jira and GitLab descriptions as available at package generation time, including user edits made in the Jira Context section.",
      "When the source branch is checked out locally, prefer inspecting live files for complete implementation context.",
    ],
    validationCommands: [
      {
        name: "lint",
        command: "npm run lint",
        result: "notRun",
      },
      {
        name: "build",
        command: "npm run build",
        result: "notRun",
      },
    ],
  };
}

function gitPathPrefix(path: string) {
  return path === "/dev/null" ? path : `a/${path}`;
}

function gitPathPostfix(path: string) {
  return path === "/dev/null" ? path : `b/${path}`;
}

function diffLooksLikeRawGitPatch(diff: string) {
  return /^diff --git /m.test(diff) || /^---\s+\S+/m.test(diff);
}

function normalizeDiffGitLine(diff: string, file: ChangedFile) {
  const lines = diff.split("\n");
  const firstLine = lines[0];

  if (!firstLine?.startsWith("diff --git ")) {
    return diff;
  }

  const expectedLine = `diff --git ${gitPathPrefix(file.oldPath)} ${gitPathPostfix(file.newPath)}`;

  if (firstLine.includes("/dev/null") && (file.isNew || file.isDeleted)) {
    lines[0] = expectedLine;
  }

  return lines.join("\n");
}

function removeRepeatedFileHeaders(diff: string) {
  const lines = diff.split("\n");
  const cleanedLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index];
    const nextLine = lines[index + 1];
    const previousHeader = cleanedLines[cleanedLines.length - 2];
    const previousPath = cleanedLines[cleanedLines.length - 1];

    if (
      currentLine.startsWith("--- ") &&
      nextLine?.startsWith("+++ ") &&
      previousHeader === currentLine &&
      previousPath === nextLine
    ) {
      index += 1;
      continue;
    }

    cleanedLines.push(currentLine);
  }

  return cleanedLines.join("\n");
}

function normalizeRawPatchBlock(diff: string, file: ChangedFile) {
  return removeRepeatedFileHeaders(normalizeDiffGitLine(diff, file));
}

function buildHunkOnlyPatch(file: ChangedFile) {
  const oldPath = file.isNew ? "/dev/null" : file.oldPath;
  const newPath = file.isDeleted ? "/dev/null" : file.newPath;
  const modeLine = file.isNew
    ? "new file mode 100644"
    : file.isDeleted
      ? "deleted file mode 100644"
      : null;

  return [
    `diff --git ${gitPathPrefix(file.oldPath)} ${gitPathPostfix(file.newPath)}`,
    modeLine,
    `--- ${gitPathPrefix(oldPath)}`,
    `+++ ${gitPathPostfix(newPath)}`,
    file.diff.trimEnd(),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUnavailableDiffMarker(file: ChangedFile) {
  return [
    `# Diff unavailable for ${file.newPath || file.oldPath}`,
    `# collapsed=${file.diffCollapsed}`,
    `# tooLarge=${file.diffTooLarge}`,
  ].join("\n");
}

function buildFilePatch(file: ChangedFile) {
  const diff = file.diff.trim();

  if (!diff) {
    return buildUnavailableDiffMarker(file);
  }

  if (diffLooksLikeRawGitPatch(diff)) {
    return normalizeRawPatchBlock(diff, file);
  }

  return buildHunkOnlyPatch(file);
}

export function buildReviewPackagePatch(input: ReviewPackageInput) {
  return input.mergeRequest.changedFiles
    .map(buildFilePatch)
    .filter(Boolean)
    .join("\n\n");
}

function markdownText(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

export function buildReviewPackageSummary(input: ReviewPackageInput) {
  const { mergeRequest, jiraIssue } = input;

  return [
    `# Review Package: ${mergeRequest.title}`,
    "",
    "## Merge Request",
    "",
    `- Project: ${mergeRequest.projectPath}`,
    `- Merge request: !${mergeRequest.iid}`,
    `- URL: ${mergeRequest.webUrl}`,
    `- Author: ${mergeRequest.author}`,
    `- Source branch: ${mergeRequest.sourceBranch}`,
    `- Target branch: ${mergeRequest.targetBranch}`,
    "",
    "### GitLab Merge Request Description",
    "",
    markdownText(
      mergeRequest.description,
      "No GitLab merge request description provided.",
    ),
    "",
    "## Jira Context",
    "",
    jiraIssue
      ? [
          `- Key: ${jiraIssue.key}`,
          `- Summary: ${jiraIssue.summary}`,
          `- Source: ${jiraIssue.source}`,
          "",
          "### Edited Jira Description",
          "",
          markdownText(jiraIssue.description, "No Jira description provided."),
        ].join("\n")
      : "No Jira issue context was loaded for this package.",
    "",
    "## Changed Files",
    "",
    ...mergeRequest.changedFiles.map(
      (file) => `- ${file.newPath} (${getFileStatus(file)}, ${file.language})`,
    ),
    "",
    "## Agent Guidance",
    "",
    "- This package is intended for a coding agent working inside an IDE.",
    "- Prefer inspecting live files when the source branch is available locally.",
    "- Use `changes.patch` when exact diff hunk context is needed.",
    "- Full file contents are intentionally excluded from this package.",
    "",
  ].join("\n");
}
