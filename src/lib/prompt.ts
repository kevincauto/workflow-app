import type {
  JiraIssue,
  MergeRequestContext,
  RetrievalResult,
} from "@/lib/types";

export const reviewSchemaText = `{
  "summary": {
    "overview": "string",
    "keyConcerns": ["string"],
    "testingFocus": ["string"]
  },
  "findings": [
    {
      "filePath": "string | null",
      "lineStart": "number | null",
      "lineEnd": "number | null",
      "severity": "High | Medium | Low",
      "category": "Bug | Logic | Security | Error Handling | Test Gap | Jira Mismatch | Maintainability | Performance",
      "commentText": "string",
      "rationale": "string",
      "isGeneralComment": "boolean",
      "codeSnippet": "string | undefined"
    }
  ]
}`;

export function buildReviewPrompt(input: {
  mergeRequest: MergeRequestContext;
  jiraIssue: JiraIssue | null;
  retrieval: RetrievalResult;
}) {
  const { mergeRequest, jiraIssue, retrieval } = input;

  const changedFilesText = mergeRequest.changedFiles
    .map((file) => {
      const diffStatus = file.diffTooLarge
        ? "too_large"
        : file.diffCollapsed
          ? "collapsed"
          : file.diff
            ? "available"
            : "unavailable";

      const diffText = file.diff
        ? file.diff
        : file.diffTooLarge
          ? "[GitLab omitted this diff because it is too large.]"
          : file.diffCollapsed
            ? "[GitLab marked this diff as collapsed. The UI can expand it, but the API response omitted the patch body here.]"
            : "[No diff body was returned by GitLab for this file.]";

      const contentText =
        file.contentStatus === "available"
          ? file.content
          : file.contentStatus === "deleted"
            ? "[File was deleted in this merge request.]"
            : `[GitLab did not return full file content for this path. Do not assume the file is empty or missing based only on this. ${file.contentError ?? ""}]`;

      return [
        `FILE: ${file.newPath}`,
        `FLAGS: deleted=${file.isDeleted} new=${file.isNew} renamed=${file.isRenamed} generated=${file.isGenerated}`,
        `DIFF_STATUS: ${diffStatus}`,
        `CONTENT_STATUS: ${file.contentStatus}`,
        "IMPORTANT: If DIFF_STATUS or CONTENT_STATUS is unavailable, collapsed, or too_large, do not claim the file is empty, missing, or broken solely because the payload is incomplete.",
        `DIFF:\n${diffText}`,
        `CONTENT:\n${contentText}`,
      ].join("\n");
    })
    .join("\n\n");

  return `You are reviewing a GitLab merge request like a strong senior engineer.
Focus on correctness, logic, security, error handling, tests, Jira requirement alignment, maintainability, and performance.
Avoid style-only comments, formatting comments, and speculative comments.
Prefer 3 to 7 strong findings and never exceed 10.
Do not infer that a file is empty, missing, or broken when the review payload explicitly marks its diff or content as unavailable, collapsed, or too large.
Use this severity rubric consistently:
- High: likely production incident, security exposure, data loss/corruption, auth/permission bypass, or a critical-path behavior that should block merge.
- Medium: meaningful functional/reliability issue with user impact, including any Jira acceptance-criteria mismatch.
- Low: non-blocking maintainability/observability improvements, minor edge cases, and test gaps by default.
Severity rules:
- Jira mismatch findings must be at least Medium.
- Test gap findings should default to Low unless there is clear evidence the gap creates meaningful near-term user or production risk.
- If uncertain between two severities, choose the lower one and explain uncertainty in rationale.
Return JSON only with this schema:
${reviewSchemaText}

Merge request title:
${mergeRequest.title}

Merge request description:
${mergeRequest.description || "No description provided."}

Source branch: ${mergeRequest.sourceBranch}
Target branch: ${mergeRequest.targetBranch}
Project: ${mergeRequest.projectPath}

Jira summary:
${jiraIssue?.summary ?? "No Jira context available."}

Jira description:
${jiraIssue?.description ?? "No Jira description available."}

Changed files:
${changedFilesText}

Related files:
${
  retrieval.relatedFiles
    .map((file) => `FILE: ${file.path}\nCONTENT:\n${file.content}`)
    .join("\n\n") || "No related files retrieved."
}

Retrieval notes:
${retrieval.notes.join("\n") || "No additional retrieval notes."}`;
}
