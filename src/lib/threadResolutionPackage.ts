import {
  buildReviewPackagePatch,
  sanitizePackageName,
} from "@/lib/reviewPackage";
import type {
  ChangedFile,
  MergeRequestComment,
  MergeRequestThread,
  ThreadResolutionPackageInput,
} from "@/lib/types";

function compareComments(
  left: MergeRequestComment,
  right: MergeRequestComment,
) {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);

  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
    return leftTime - rightTime;
  }

  return left.createdAt.localeCompare(right.createdAt);
}

export function groupMergeRequestThreads(
  comments: MergeRequestComment[],
): MergeRequestThread[] {
  const groups = new Map<string, MergeRequestComment[]>();

  for (const comment of comments) {
    const group = groups.get(comment.discussionId) ?? [];
    group.push(comment);
    groups.set(comment.discussionId, group);
  }

  return Array.from(groups, ([discussionId, groupedComments]): MergeRequestThread => {
    const sortedComments = [...groupedComments].sort(compareComments);
    const locationComment = sortedComments.find((comment) => comment.filePath);
    const resolvableComments = sortedComments.filter(
      (comment) => comment.resolvable,
    );

    return {
      discussionId,
      comments: sortedComments,
      filePath: locationComment?.filePath ?? null,
      lineNumber: locationComment?.lineNumber ?? null,
      status:
        resolvableComments.length === 0
          ? "not-resolvable"
          : resolvableComments.every((comment) => comment.resolved)
            ? "resolved"
            : "unresolved",
    };
  }).sort((left, right) =>
    compareComments(left.comments[0], right.comments[0]),
  );
}

function getFileStatus(file: ChangedFile) {
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

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "Unknown" : date.toISOString();
}

function markdownText(value: string, fallback: string) {
  return value.trim() || fallback;
}

function formatLocation(thread: MergeRequestThread) {
  if (thread.filePath && thread.lineNumber) {
    return `${thread.filePath}:${thread.lineNumber}`;
  }

  return thread.filePath ?? "Merge request level discussion";
}

function quoteMarkdown(value: string) {
  return value
    .trim()
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function getThreadExcerpt(thread: MergeRequestThread, maxLength = 140) {
  const feedback = thread.comments[0]?.body.trim().replace(/\s+/g, " ") ?? "";

  if (feedback.length <= maxLength) {
    return feedback || "Discussion without comment text";
  }

  return `${feedback.slice(0, maxLength - 3).trimEnd()}...`;
}

export function getThreadResolutionPackageFolderName(
  input: ThreadResolutionPackageInput,
) {
  const safeProject =
    sanitizePackageName(input.mergeRequest.projectName) || "merge-request";

  return `thread-resolution-${safeProject}-mr-${input.mergeRequest.iid}`;
}

export function buildThreadResolutionManifest(
  input: ThreadResolutionPackageInput,
) {
  const threads = groupMergeRequestThreads(input.comments);
  const statusCounts = threads.reduce(
    (counts, thread) => {
      counts[thread.status] += 1;
      return counts;
    },
    { resolved: 0, unresolved: 0, "not-resolvable": 0 },
  );

  return {
    packageVersion: 1,
    generatedAt: input.generatedAt,
    packageFiles: [
      "manifest.json",
      "summary.md",
      "threads.md",
      "changes.patch",
      "agent-prompt.md",
    ],
    intendedUse:
      "Evidence-based verification of GitLab review feedback and a fresh regression review by an IDE coding agent.",
    mergeRequest: {
      source: input.mergeRequest.source,
      projectId: input.mergeRequest.projectId,
      projectPath: input.mergeRequest.projectPath,
      projectName: input.mergeRequest.projectName,
      iid: input.mergeRequest.iid,
      title: input.mergeRequest.title,
      webUrl: input.mergeRequest.webUrl,
      author: input.mergeRequest.author,
      sourceBranch: input.mergeRequest.sourceBranch,
      targetBranch: input.mergeRequest.targetBranch,
      diffRefs: input.mergeRequest.diffRefs,
    },
    discussions: {
      threadCount: threads.length,
      noteCount: input.comments.length,
      gitLabStatusCounts: statusCounts,
    },
    changedFiles: input.mergeRequest.changedFiles.map((file) => ({
      oldPath: file.oldPath,
      newPath: file.newPath,
      language: file.language,
      status: getFileStatus(file),
      isGenerated: file.isGenerated,
      diffCollapsed: file.diffCollapsed,
      diffTooLarge: file.diffTooLarge,
    })),
    repositoryContext: input.mergeRequest.repositoryContext ?? null,
    knownConstraints: [
      "GitLab resolution status is metadata and is not proof that feedback was addressed.",
      "Full file contents are excluded; inspect live repository files when the source branch is checked out.",
      "GitLab may omit diff context when a changed file is collapsed or too large.",
      "The package asks the agent to review and draft responses, not edit code or post comments.",
    ],
  };
}

export function buildThreadResolutionSummary(
  input: ThreadResolutionPackageInput,
) {
  const threads = groupMergeRequestThreads(input.comments);

  return [
    `# Thread Resolution Review: ${input.mergeRequest.title}`,
    "",
    "## Merge Request",
    "",
    `- Project: ${input.mergeRequest.projectPath}`,
    `- Merge request: !${input.mergeRequest.iid}`,
    `- URL: ${input.mergeRequest.webUrl}`,
    `- Author: ${input.mergeRequest.author}`,
    `- Source branch: ${input.mergeRequest.sourceBranch}`,
    `- Target branch: ${input.mergeRequest.targetBranch}`,
    `- Generated at: ${formatDate(input.generatedAt)}`,
    `- Human discussions: ${threads.length}`,
    `- Human notes: ${input.comments.length}`,
    "",
    "## GitLab Merge Request Description",
    "",
    markdownText(
      input.mergeRequest.description,
      "No GitLab merge request description was provided.",
    ),
    "",
    "## Changed Files",
    "",
    ...(input.mergeRequest.changedFiles.length
      ? input.mergeRequest.changedFiles.map(
          (file) =>
            `- ${file.newPath} (${getFileStatus(file)}, ${file.language})`,
        )
      : ["No changed files were returned by GitLab."]),
    "",
    "## Package Guidance",
    "",
    "- Start with `agent-prompt.md` for the required workflow and output format.",
    "- Use `threads.md` as the complete human discussion record.",
    "- Use `changes.patch` for GitLab diff hunks and inspect live files for complete current context.",
    "- Treat GitLab's resolved state as metadata only.",
    "",
  ].join("\n");
}

export function buildThreadResolutionThreads(
  input: ThreadResolutionPackageInput,
) {
  const threads = groupMergeRequestThreads(input.comments);

  if (threads.length === 0) {
    return [
      `# GitLab Discussions For MR !${input.mergeRequest.iid}`,
      "",
      "No human discussion notes were returned by GitLab.",
      "",
    ].join("\n");
  }

  return [
    `# GitLab Discussions For MR !${input.mergeRequest.iid}`,
    "",
    "GitLab status below is metadata only. Verify the current implementation before deciding whether feedback was addressed.",
    "",
    ...threads.flatMap((thread, threadIndex) => [
      `## ${threadIndex + 1}. ${getThreadExcerpt(thread)}`,
      "",
      `- Location: ${formatLocation(thread)}`,
      `- GitLab status: ${thread.status}`,
      `- Notes: ${thread.comments.length}`,
      "",
      ...thread.comments.flatMap((comment, noteIndex) => [
        `### ${noteIndex + 1}. ${comment.author}`,
        "",
        `- Created: ${formatDate(comment.createdAt)}`,
        `- Resolvable: ${comment.resolvable ? "Yes" : "No"}`,
        `- Resolved in GitLab: ${comment.resolved ? "Yes" : "No"}`,
        "",
        quoteMarkdown(comment.body),
        "",
      ]),
    ]),
  ].join("\n");
}

export function buildThreadResolutionPatch(
  input: ThreadResolutionPackageInput,
) {
  return buildReviewPackagePatch({
    generatedAt: input.generatedAt,
    mergeRequest: input.mergeRequest,
    jiraIssue: null,
  });
}

export function buildThreadResolutionAgentPrompt(
  input: ThreadResolutionPackageInput,
) {
  return [
    `# Verify Review Threads For MR !${input.mergeRequest.iid}`,
    "",
    "You are an IDE coding agent acting as a senior engineer. Determine whether every GitLab review discussion has actually been addressed, then perform a fresh review for issues introduced or left behind by the merge request.",
    "",
    "This is a review-only task. Do not modify files and do not post comments unless the user explicitly asks you to do so after the review.",
    "",
    "## Inputs",
    "",
    "- Read `summary.md` for merge request context and the changed-file list.",
    "- Read every discussion and reply in `threads.md`.",
    "- Use `changes.patch` for the GitLab-provided diff baseline.",
    "- Inspect live repository files and relevant tests when the source branch is checked out locally.",
    "- Use validation guidance in `manifest.json` when practical.",
    "- Do not treat GitLab's resolved flag as proof that feedback was addressed.",
    "",
    "## Thread Verification",
    "",
    "For every discussion, classify the current implementation as exactly one of:",
    "",
    "- `Addressed`: the feedback is fully satisfied by the current code and tests.",
    "- `Partially Addressed`: some intent is implemented, but a concrete gap remains.",
    "- `Not Addressed`: the requested correction is absent or contradicted by the current implementation.",
    "- `Unable to Verify`: repository or runtime evidence needed for a defensible decision is unavailable.",
    "",
    "For each classification, cite concrete file, line, behavior, test, or command evidence. Account for all replies in the discussion, including later clarification or disagreement.",
    "",
    "## Fresh Regression Review",
    "",
    "After checking the discussions, independently review the changed code for correctness, logic, security, error handling, test gaps, maintainability, and performance. Report only concrete, actionable issues introduced or still present in this merge request. Avoid style-only or speculative comments.",
    "",
    "Run focused validation where practical. Report commands and outcomes, plus anything that could not be run.",
    "",
    "## Required Output",
    "",
    "1. **Final Verdict**: State whether all feedback is addressed and whether any remaining or newly introduced issue should block or delay merge.",
    "2. **Thread Results**: One section per discussion. Use a readable heading containing the first 100-140 characters of the original feedback.",
    "   - Include an `Original feedback` block quoting the complete initial comment. Do not replace or truncate it to an ID. If the comment is unusually long, quote at least the first 500 characters and clearly mark that it was shortened.",
    "   - Include the original location, classification, concrete evidence, remaining action, and a paste-ready reply to the colleague. Summarize relevant follow-up replies so the thread's context is understandable without reopening `threads.md`.",
    "   - For fully addressed feedback, the reply should briefly explain the evidence. For gaps, state exactly what remains to be done.",
    "   - Do not include GitLab discussion IDs, note IDs, or other opaque internal identifiers anywhere in the human-facing response.",
    "3. **New Issues**: For each fresh finding, include severity, exact file and line, evidence, impact, recommended correction, and a paste-ready GitLab comment. State `No new issues found` when appropriate.",
    "4. **Validation**: List commands run and results, then identify unverified risks.",
    "",
    "Suggested replies must be concise, professional, specific to the evidence, and ready to paste into GitLab without editing.",
    "",
  ].join("\n");
}
