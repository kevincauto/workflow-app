import { fetchRepositoryFile } from "@/lib/gitlab";
import type {
  ChangedFile,
  MergeRequestContext,
  RetrievalResult,
} from "@/lib/types";

const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];
const MAX_RELATED_FILES = 8;
const MAX_SECOND_PASS = 3;

function normalizeRelativePath(fromFile: string, requestedPath: string) {
  const baseParts = fromFile.split("/").slice(0, -1);
  const requestParts = requestedPath.split("/");
  const output: string[] = [...baseParts];

  for (const part of requestParts) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      output.pop();
      continue;
    }

    output.push(part);
  }

  return output.join("/");
}

function collectImportCandidates(file: ChangedFile) {
  const importPattern = /from\s+["']([^"']+)["']/g;
  const candidates = new Set<string>();
  let match: RegExpExecArray | null = importPattern.exec(file.content);

  while (match) {
    const specifier = match[1];
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const resolved = normalizeRelativePath(file.newPath, specifier);
      EXTENSIONS.forEach((extension) => {
        candidates.add(`${resolved}${extension}`);
      });
    }

    if (specifier.startsWith("@/")) {
      const resolved = specifier.replace(/^@\//, "src/");
      EXTENSIONS.forEach((extension) => {
        candidates.add(`${resolved}${extension}`);
      });
    }

    match = importPattern.exec(file.content);
  }

  return candidates;
}

function collectLikelyTests(file: ChangedFile) {
  const candidates = new Set<string>();
  const base = file.newPath.replace(/\.(ts|tsx|js|jsx)$/, "");
  candidates.add(`${base}.test.ts`);
  candidates.add(`${base}.test.tsx`);
  candidates.add(`${base}.spec.ts`);
  candidates.add(`${base}.spec.tsx`);

  const segments = file.newPath.split("/");
  const fileName = segments.pop();
  if (fileName) {
    candidates.add(
      [
        ...segments,
        "__tests__",
        fileName.replace(/\.(ts|tsx)$/, ".test.tsx"),
      ].join("/"),
    );
  }

  return candidates;
}

function collectSharedFiles(file: ChangedFile) {
  const segments = file.newPath.split("/");
  segments.pop();
  if (segments.length === 0) {
    return new Set<string>();
  }

  return new Set<string>([
    [...segments, "types.ts"].join("/"),
    [...segments, "hooks.ts"].join("/"),
    [...segments, "utils.ts"].join("/"),
  ]);
}

async function resolveCandidateFiles(
  mergeRequest: MergeRequestContext,
  candidates: string[],
  source: "heuristic" | "second-pass",
) {
  const deduped = Array.from(new Set(candidates));
  const results = [] as RetrievalResult["relatedFiles"];

  for (const candidate of deduped) {
    if (results.length >= MAX_RELATED_FILES) {
      break;
    }

    if (mergeRequest.changedFiles.some((file) => file.newPath === candidate)) {
      continue;
    }

    const content = await fetchRepositoryFile(mergeRequest, candidate);
    if (!content) {
      continue;
    }

    results.push({
      path: candidate,
      content,
      source,
    });
  }

  return results;
}

export async function collectRetrievalContext(
  mergeRequest: MergeRequestContext,
): Promise<RetrievalResult> {
  const candidates = new Set<string>();

  for (const file of mergeRequest.changedFiles) {
    collectImportCandidates(file).forEach((candidate) =>
      candidates.add(candidate),
    );
    collectLikelyTests(file).forEach((candidate) => candidates.add(candidate));
    collectSharedFiles(file).forEach((candidate) => candidates.add(candidate));
  }

  const relatedFiles = await resolveCandidateFiles(
    mergeRequest,
    Array.from(candidates),
    "heuristic",
  );

  return {
    relatedFiles,
    notes: [
      `Retrieved ${relatedFiles.length} related files using import, test, and shared-file heuristics.`,
      "Changed files, diffs, and full changed-file contents are always included in the review prompt.",
    ],
    secondPassCandidates: Array.from(candidates).slice(0, MAX_SECOND_PASS),
  };
}

export async function fetchSecondPassFiles(input: {
  mergeRequest: MergeRequestContext;
  requestedPaths: string[];
}): Promise<RetrievalResult["relatedFiles"]> {
  return resolveCandidateFiles(
    input.mergeRequest,
    input.requestedPaths.slice(0, MAX_SECOND_PASS),
    "second-pass",
  );
}
