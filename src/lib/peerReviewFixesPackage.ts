import { sanitizePackageName } from "@/lib/reviewPackage";
import type {
  MergeRequestComment,
  PeerReviewFixesPackageInput,
} from "@/lib/types";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "Unknown";
  }

  return date.toISOString();
}

function formatLocation(comment: MergeRequestComment) {
  if (comment.filePath && comment.lineNumber) {
    return `${comment.filePath}:${comment.lineNumber}`;
  }

  if (comment.filePath) {
    return comment.filePath;
  }

  return "Merge request level comment";
}

function formatComment(comment: MergeRequestComment, index: number) {
  return [
    `### ${index + 1}. Feedback From ${comment.author}`,
    "",
    `- Location: ${formatLocation(comment)}`,
    `- Created: ${formatDate(comment.createdAt)}`,
    `- Discussion id: ${comment.discussionId}`,
    `- Note id: ${comment.noteId}`,
    `- Resolved in GitLab: ${comment.resolved ? "Yes" : "No"}`,
    "",
    "```markdown",
    comment.body.trim(),
    "```",
  ].join("\n");
}

export function getPeerReviewFixesFileName(input: PeerReviewFixesPackageInput) {
  const safeProject = sanitizePackageName(input.mergeRequest.projectName);
  const safeTitle = sanitizePackageName(input.mergeRequest.title).slice(0, 36);

  return [
    "peer-review-fixes",
    safeProject,
    `mr-${input.mergeRequest.iid}`,
    safeTitle,
  ]
    .filter(Boolean)
    .join("-");
}

export function buildPeerReviewFixesPrompt(input: PeerReviewFixesPackageInput) {
  const selectedComments = input.comments.filter((comment) => comment.selected);

  return [
    `# Peer Review Fixes For MR !${input.mergeRequest.iid}`,
    "",
    "You are an IDE coding agent working in the local repository. Inspect the merge request comments from colleagues who left feedback, then decide whether you agree or disagree with each comment.",
    "",
    "If you agree with a comment, implement the best solution to satisfy the feedback. If you disagree, that is ok, but provide a clear reason why the requested change should not be made.",
    "",
    "Generate an organized response to each piece of feedback. For every item, include what was done about it and how you would comment back to the colleague.",
    "",
    "## Merge Request",
    "",
    `- Project: ${input.mergeRequest.projectPath}`,
    `- Title: ${input.mergeRequest.title}`,
    `- URL: ${input.mergeRequest.webUrl}`,
    `- Author: ${input.mergeRequest.author}`,
    `- Source branch: ${input.mergeRequest.sourceBranch}`,
    `- Target branch: ${input.mergeRequest.targetBranch}`,
    `- Generated at: ${formatDate(input.generatedAt)}`,
    "",
    "## Expected Agent Behavior",
    "",
    "- Inspect the existing codebase before editing.",
    "- Review the merge request changes and the files referenced by the selected comments.",
    "- Treat each selected comment as colleague feedback that needs an explicit agree/disagree decision.",
    "- When agreeing, make the focused code change that best satisfies the feedback.",
    "- When disagreeing, leave the code unchanged for that item and explain why.",
    "- Run focused validation where practical and report anything that could not be verified.",
    "- Produce a final organized response with one section per feedback item, including the colleague name, location, decision, action taken, validation, and suggested reply.",
    "",
    "## Selected Merge Request Comments",
    "",
    selectedComments.length > 0
      ? selectedComments
          .map((comment, index) => formatComment(comment, index))
          .join("\n\n")
      : "No comments were selected for export.",
    "",
  ].join("\n");
}
