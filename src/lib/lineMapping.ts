import type {
  ChangedFile,
  MergeRequestContext,
  ReviewFinding,
} from "@/lib/types";

interface AddedLine {
  lineNumber: number;
  content: string;
}

function parseAddedLines(diff: string): AddedLine[] {
  const lines = diff.split("\n");
  const addedLines: AddedLine[] = [];
  let currentNewLine = 0;

  for (const line of lines) {
    const headerMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (headerMatch) {
      currentNewLine = Number(headerMatch[1]);
      continue;
    }

    if (!line) {
      continue;
    }

    if (line.startsWith("+")) {
      addedLines.push({
        lineNumber: currentNewLine,
        content: line.slice(1),
      });
      currentNewLine += 1;
      continue;
    }

    if (!line.startsWith("-")) {
      currentNewLine += 1;
    }
  }

  return addedLines;
}

function findChangedFile(
  mergeRequest: MergeRequestContext,
  filePath: string | null,
): ChangedFile | undefined {
  if (!filePath) {
    return undefined;
  }

  return mergeRequest.changedFiles.find(
    (file) => file.newPath === filePath || file.oldPath === filePath,
  );
}

export function normalizeFindingsAgainstDiff(
  mergeRequest: MergeRequestContext,
  findings: ReviewFinding[],
): ReviewFinding[] {
  return findings.map((finding) => {
    const changedFile = findChangedFile(mergeRequest, finding.filePath);

    if (!changedFile || finding.lineStart === null) {
      return { ...finding, isGeneralComment: true };
    }

    const addedLines = parseAddedLines(changedFile.diff);
    const hasExactLine = addedLines.some(
      (line) => line.lineNumber === finding.lineStart,
    );

    if (hasExactLine) {
      return finding;
    }

    const fallbackLine = addedLines[0];
    if (!fallbackLine) {
      return {
        ...finding,
        isGeneralComment: true,
        lineStart: null,
        lineEnd: null,
      };
    }

    return {
      ...finding,
      lineStart: fallbackLine.lineNumber,
      lineEnd: fallbackLine.lineNumber,
      codeSnippet: finding.codeSnippet ?? fallbackLine.content.trim(),
      isGeneralComment: false,
    };
  });
}

export function getCommentBody(finding: ReviewFinding): string {
  if (finding.isGeneralComment && finding.filePath) {
    return `${finding.filePath}: ${finding.commentText}`;
  }

  return finding.commentText;
}
