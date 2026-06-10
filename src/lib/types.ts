export type Severity = "High" | "Medium" | "Low";

export type ReviewCategory =
  | "Bug"
  | "Logic"
  | "Security"
  | "Error Handling"
  | "Test Gap"
  | "Jira Mismatch"
  | "Maintainability"
  | "Performance";

export interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  source: "live" | "mock";
}

export interface JiraCandidate {
  key: string;
  source: "title" | "description" | "branch";
}

export interface GitLabDiffRefs {
  baseSha: string | null;
  headSha: string | null;
  startSha: string | null;
}

export interface ChangedFile {
  oldPath: string;
  newPath: string;
  diff: string;
  content: string;
  contentStatus: "available" | "deleted" | "unavailable";
  contentError: string | null;
  language: string;
  isDeleted: boolean;
  isNew: boolean;
  isRenamed: boolean;
  isGenerated: boolean;
  diffCollapsed: boolean;
  diffTooLarge: boolean;
}

export interface MergeRequestContext {
  source: "live" | "mock";
  projectId: string;
  projectPath: string;
  projectName: string;
  webUrl: string;
  iid: string;
  title: string;
  description: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  changedFiles: ChangedFile[];
  diffRefs: GitLabDiffRefs;
}

export interface RelatedFile {
  path: string;
  content: string;
  source: "heuristic" | "second-pass";
}

export interface RetrievalResult {
  relatedFiles: RelatedFile[];
  notes: string[];
  secondPassCandidates: string[];
}

export interface ReviewFinding {
  id: string;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  severity: Severity;
  category: ReviewCategory;
  commentText: string;
  rationale: string;
  isGeneralComment: boolean;
  codeSnippet?: string;
  approved: boolean;
}

export interface ReviewSummary {
  overview: string;
  keyConcerns: string[];
  testingFocus: string[];
}

export interface ReviewResult {
  summary: ReviewSummary;
  findings: ReviewFinding[];
  retrieval: RetrievalResult;
  source: "live" | "mock";
}

export interface PostResult {
  findingId: string;
  status: "posted" | "failed" | "skipped";
  mode: "inline" | "general";
  detail: string;
}

export interface LoadMrResponse {
  mergeRequest: MergeRequestContext;
  jiraCandidates: JiraCandidate[];
  jiraIssue: JiraIssue | null;
  notices: string[];
}

export interface OpenMergeRequestOption {
  iid: string;
  title: string;
  webUrl: string;
  projectPath: string;
  projectName: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  updatedAt: string;
}

export interface ListOpenMergeRequestsResponse {
  mergeRequests: OpenMergeRequestOption[];
}

export interface ReviewRequestPayload {
  mergeRequest: MergeRequestContext;
  jiraIssue: JiraIssue | null;
}

export interface PostCommentsPayload {
  mergeRequest: MergeRequestContext;
  findings: ReviewFinding[];
}
