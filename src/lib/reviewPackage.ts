import type {
  ChangedFile,
  FigmaViewport,
  JiraIssue,
  MergeRequestContext,
  PackageAttachment,
  PackagedFigmaContext,
} from "@/lib/types";

export type ReviewPackageFiles = Record<string, string | Uint8Array>;

export interface ReviewPackageInput {
  generatedAt: string;
  mergeRequest: MergeRequestContext;
  jiraIssue: JiraIssue | null;
  attachments: PackageAttachment[];
  figmaContexts: PackagedFigmaContext[];
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

export function getFigmaFileName(viewport: FigmaViewport) {
  return `figma-context-${viewport}.json`;
}

function getFileExtension(filename: string) {
  const extension = filename.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1];
  return extension ? `.${extension.toLowerCase()}` : "";
}

export function buildPackagedAttachments(attachments: PackageAttachment[]) {
  const usedNames = new Set<string>();

  return attachments.map((attachment, index) => {
    const extension = getFileExtension(attachment.filename);
    const filenameWithoutExtension = extension
      ? attachment.filename.slice(0, -extension.length)
      : attachment.filename;
    const baseName =
      sanitizePackageName(filenameWithoutExtension) || `file-${index + 1}`;
    let packagedName = `${baseName}${extension}`;
    let suffix = 2;

    while (usedNames.has(packagedName)) {
      packagedName = `${baseName}-${suffix}${extension}`;
      suffix += 1;
    }

    usedNames.add(packagedName);
    return { attachment, path: `attachments/${packagedName}` };
  });
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
  const repositoryContext = mergeRequest.repositoryContext;
  const packagedAttachments = buildPackagedAttachments(input.attachments);
  const figmaFiles = input.figmaContexts.map(({ viewport }) =>
    getFigmaFileName(viewport),
  );

  return {
    packageVersion: 2,
    generatedAt: input.generatedAt,
    packageFiles: [
      "manifest.json",
      "changes.patch",
      "summary.md",
      "agent-prompt.md",
      ...figmaFiles,
      ...packagedAttachments.map(({ path }) => path),
    ],
    intendedUse:
      "Code review context package for an IDE coding agent. Inspect live files when the branch is checked out; use changes.patch for exact diff hunks.",
    sourceSystems: {
      mergeRequest: "GitLab REST API",
      issue: jiraIssue ? "Jira REST API" : null,
      figma: input.figmaContexts.length ? "Figma REST API" : null,
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
    attachments: packagedAttachments.map(({ attachment, path }) => ({
      source: attachment.source,
      originalFilename: attachment.filename,
      packagedPath: path,
      mimeType: attachment.mimeType,
      size: attachment.size,
      jiraAttachmentId: attachment.jiraAttachmentId,
      explanation: attachment.explanation,
    })),
    figma: input.figmaContexts.map(({ viewport, context: figma }) => ({
      viewport,
      json: getFigmaFileName(viewport),
      fileKey: figma.fileKey,
      nodeId: figma.nodeId,
      fileName: figma.fileName,
      selectedNodeName: figma.selectedNodeName,
      selectedNodeType: figma.selectedNodeType,
      previewImageUrl: figma.previewImageUrl,
      detectedControlCount: figma.detectedControls.length,
    })),
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
    repositoryContext: repositoryContext
      ? {
          packageManager: repositoryContext.packageManager,
          packageManagerName: repositoryContext.packageManagerName,
          detectedFiles: repositoryContext.detectedFiles,
          packageJson: repositoryContext.packageJson
            ? {
                packageManager: repositoryContext.packageJson.packageManager,
                scripts: repositoryContext.packageJson.scripts,
              }
            : null,
          validationCommands: repositoryContext.validationCommands,
          suggestedFocusedCommands: repositoryContext.suggestedFocusedCommands,
          notes: repositoryContext.notes,
        }
      : {
          packageManager: null,
          packageManagerName: null,
          detectedFiles: null,
          packageJson: null,
          validationCommands: [],
          suggestedFocusedCommands: [],
          notes: ["Repository metadata was not available from GitLab."],
        },
    knownConstraints: [
      "Full file contents are intentionally excluded from this package.",
      "changes.patch contains GitLab-provided unified diff hunks and may omit context if GitLab marks a diff collapsed or too large.",
      "summary.md contains Jira and GitLab descriptions as available at package generation time, including user edits made in the Jira Context section.",
      "agent-prompt.md contains lightweight review instructions and intentionally excludes full file contents.",
      "When the source branch is checked out locally, prefer inspecting live files for complete implementation context.",
      "Validation and focused command suggestions live under repositoryContext as the canonical source of truth.",
      "Jira and uploaded attachment binaries are stored under attachments/ and contain no credentials.",
      "Figma context is normalized and intentionally compact; raw Figma payloads are excluded and preview image URLs may expire.",
    ],
  };
}

function gitPathPrefix(path: string) {
  return path === "/dev/null" ? path : `a/${path}`;
}

function gitPathPostfix(path: string) {
  return path === "/dev/null" ? path : `b/${path}`;
}

function hasDiffGitHeader(diff: string) {
  return diff.startsWith("diff --git ");
}

function hasFileHeader(diff: string) {
  return diff.startsWith("--- ");
}

function getStandardDiffGitLine(file: ChangedFile) {
  return `diff --git ${gitPathPrefix(file.oldPath)} ${gitPathPostfix(file.newPath)}`;
}

function getModeLine(file: ChangedFile) {
  if (file.isNew) {
    return "new file mode 100644";
  }

  if (file.isDeleted) {
    return "deleted file mode 100644";
  }

  return null;
}

function normalizeDiffGitLine(diff: string, file: ChangedFile) {
  const lines = diff.split("\n");
  const firstLine = lines[0];

  if (!firstLine?.startsWith("diff --git ")) {
    return diff;
  }

  const expectedLine = getStandardDiffGitLine(file);

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
  if (hasDiffGitHeader(diff)) {
    return removeRepeatedFileHeaders(normalizeDiffGitLine(diff, file));
  }

  if (hasFileHeader(diff)) {
    return [getStandardDiffGitLine(file), getModeLine(file), diff]
      .filter(Boolean)
      .join("\n");
  }

  return diff;
}

function buildHunkOnlyPatch(file: ChangedFile) {
  const oldPath = file.isNew ? "/dev/null" : file.oldPath;
  const newPath = file.isDeleted ? "/dev/null" : file.newPath;

  return [
    getStandardDiffGitLine(file),
    getModeLine(file),
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

  if (hasDiffGitHeader(diff) || hasFileHeader(diff)) {
    return normalizeRawPatchBlock(diff, file);
  }

  return buildHunkOnlyPatch(file);
}

export function buildReviewPackagePatch(
  input: Pick<ReviewPackageInput, "mergeRequest">,
) {
  return input.mergeRequest.changedFiles
    .map(buildFilePatch)
    .filter(Boolean)
    .join("\n\n");
}

function markdownText(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

function buildReviewerBrief(input: ReviewPackageInput) {
  const { mergeRequest, jiraIssue } = input;

  if (!jiraIssue) {
    return [
      "## Reviewer Brief",
      "",
      `Review merge request !${mergeRequest.iid} against the GitLab description and changed files. No Jira issue context was loaded for this package.`,
      "",
    ].join("\n");
  }

  return [
    "## Reviewer Brief",
    "",
    `Review merge request !${mergeRequest.iid} for Jira issue ${jiraIssue.key}: ${jiraIssue.summary}`,
    "",
    "Use the edited Jira description below as the requirements source of truth, and flag any implementation, test, or behavior mismatch against it.",
    "",
  ].join("\n");
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
    buildReviewerBrief(input),
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
    "## Attached Files",
    "",
    input.attachments.length
      ? buildPackagedAttachments(input.attachments)
          .map(({ attachment, path }) =>
            [
              `- \`${path}\` (${attachment.source}, ${attachment.mimeType})`,
              `  - Context: ${markdownText(attachment.explanation, "No additional context provided.")}`,
            ].join("\n"),
          )
          .join("\n")
      : "No files were attached to this package.",
    "",
    "## Design Context",
    "",
    input.figmaContexts.length
      ? input.figmaContexts
          .map(
            ({ viewport, context }) =>
              `- \`${getFigmaFileName(viewport)}\` (${viewport}): ${context.fileName ?? "Unknown file"} / ${context.selectedNodeName ?? "Unknown node"}`,
          )
          .join("\n")
      : "No Figma design context was attached to this package.",
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
    "- Start with `agent-prompt.md` for review instructions and feedback classification guidance.",
    "- Prefer inspecting live files when the source branch is available locally.",
    "- Use `changes.patch` when exact diff hunk context is needed.",
    "- Full file contents are intentionally excluded from this package.",
    "",
  ].join("\n");
}

export function buildReviewPackageAgentPrompt(input: ReviewPackageInput) {
  const { mergeRequest, jiraIssue } = input;

  return [
    `# Review Merge Request !${mergeRequest.iid}`,
    "",
    "You are an IDE coding agent acting as a strong senior engineer performing a merge request review.",
    "",
    "## Review Context",
    "",
    `- Project: ${mergeRequest.projectPath}`,
    `- Merge request: !${mergeRequest.iid}`,
    `- Title: ${mergeRequest.title}`,
    `- Source branch: ${mergeRequest.sourceBranch}`,
    `- Target branch: ${mergeRequest.targetBranch}`,
    jiraIssue
      ? `- Jira issue: ${jiraIssue.key} ${jiraIssue.summary}`
      : "- Jira issue: No Jira context was loaded for this package.",
    "",
    "## How To Use This Package",
    "",
    "- Use `summary.md` for the merge request description, Jira context, and changed-file list.",
    "- Use `changes.patch` for exact GitLab diff hunks and line-level review context.",
    "- When the source branch is checked out locally, inspect live repository files for complete implementation context.",
    "- Full file contents are intentionally excluded from this package.",
    "- If a diff is unavailable, collapsed, or too large, do not infer that the file is empty, missing, or broken based only on the package payload.",
    "",
    "## Attachment References",
    "",
    input.attachments.length
      ? "Inspect every supported file under `attachments/` as review context. Before interpreting a file, read its matching Context entry in `summary.md` or explanation in `manifest.json`. Use the manifest to distinguish Jira attachments from session uploads. Treat attachments as supporting requirement evidence and flag implementation mismatches against them."
      : "No attachment references are included.",
    "",
    "## Design Context",
    "",
    input.figmaContexts.length
      ? `Use ${input.figmaContexts
          .map(
            ({ viewport }) =>
              `\`${getFigmaFileName(viewport)}\` as the expected ${viewport} design`,
          )
          .join(
            ", ",
          )}. Apply each extraction only to its named responsive viewport and report visual or structural mismatches as review findings. Read implementationSummary first, then hierarchy, colors, and iconMeasurements for supporting geometry. Respect extractionCoverage and ambiguityNotes: do not raise findings from geometry that is missing, truncated, or flagged ambiguous.`
      : "No Figma design context is attached. Do not raise visual-fidelity findings.",
    "",
    "## Review Priorities",
    "",
    "Focus on correctness, logic, security, error handling, tests, Jira requirement alignment, maintainability, and performance.",
    "Avoid style-only comments, formatting comments, speculative comments, and comments that do not identify a concrete risk or improvement.",
    "",
    "## Feedback Categories",
    "",
    "Classify each finding with one of these categories:",
    "",
    "- `Bug`",
    "- `Logic`",
    "- `Security`",
    "- `Error Handling`",
    "- `Test Gap`",
    "- `Jira Mismatch`",
    "- `Maintainability`",
    "- `Performance`",
    "",
    "## Severity Rubric",
    "",
    "- `High`: likely production incident, security exposure, data loss or corruption, auth or permission bypass, or critical-path behavior that should block merge.",
    "- `Medium`: meaningful functional or reliability issue with user impact, including any Jira acceptance-criteria mismatch.",
    "- `Low`: non-blocking maintainability or observability improvement, minor edge case, or test gap by default.",
    "",
    "Severity rules:",
    "",
    "- Jira mismatch findings must be at least `Medium`.",
    "- Test gap findings should default to `Low` unless there is clear evidence the gap creates meaningful near-term user or production risk.",
    "- If uncertain between two severities, choose the lower one and explain the uncertainty in the rationale.",
    "",
    "## Expected Feedback Shape",
    "",
    "For each finding, include:",
    "",
    "- File path and line number when the issue can be safely anchored to the diff or live file.",
    "- Severity.",
    "- Category.",
    "- Concise review comment text suitable for posting on the merge request.",
    "- Rationale explaining the risk and why the change matters.",
    "- Mark the finding as a general merge request comment when it cannot be safely anchored to a specific line.",
    "",
  ].join("\n");
}

export function buildReviewPackageFiles(input: ReviewPackageInput) {
  const files: ReviewPackageFiles = {
    "manifest.json": JSON.stringify(buildReviewPackageManifest(input), null, 2),
    "changes.patch": buildReviewPackagePatch(input),
    "summary.md": buildReviewPackageSummary(input),
    "agent-prompt.md": buildReviewPackageAgentPrompt(input),
  };

  input.figmaContexts.forEach((figma) => {
    files[getFigmaFileName(figma.viewport)] = JSON.stringify(
      { viewport: figma.viewport, ...figma.context },
      null,
      2,
    );
  });

  for (const { attachment, path } of buildPackagedAttachments(
    input.attachments,
  )) {
    files[path] = attachment.data;
  }

  return files;
}
