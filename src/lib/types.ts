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
  webUrl: string;
  source: "live" | "mock";
}

export interface JiraAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number | null;
}

export type JiraImageAttachment = JiraAttachment;

export interface JiraSprintInfo {
  id: string;
  name: string;
  state: "active" | "future" | "closed" | "unknown";
  startDate: string | null;
  endDate: string | null;
}

export interface JiraTicketOption extends JiraIssue {
  status: string | null;
  priority: string | null;
  issueType: string | null;
  assignee: string | null;
  developer: string | null;
  estimatePoints: number | null;
  updatedAt: string | null;
  sprint: JiraSprintInfo | null;
  attachments: JiraAttachment[];
}

export interface ListAssignedJiraTicketsResponse {
  tickets: JiraTicketOption[];
  source: "live" | "mock";
  assignee: string;
  notices: string[];
}

export interface ListJiraAttachmentsResponse {
  attachments: JiraAttachment[];
}

export interface FigmaUrlParts {
  fileKey: string;
  nodeId: string | null;
  fileName: string | null;
  url: string;
}

export interface FigmaColorToken {
  name: string;
  color: string;
  value: string;
  nodeId: string;
  path: string;
  node: string;
  role: string | null;
}

export interface FigmaImplementationSummary {
  actions: {
    layout: "horizontal" | "vertical" | "none" | null;
    gap: number | null;
    buttonSize: number | null;
    iconSize: number | null;
    icons: string[];
    sourceNodeIds: {
      containers: string[];
      targets: string[];
      glyphs: string[];
    };
  } | null;
}

export interface FigmaTextNode {
  name: string;
  characters: string;
  fontFamily: string | null;
  fontSize: number | null;
  fontWeight: number | null;
  lineHeight: string | null;
}

export interface FigmaLayerNode {
  id: string;
  name: string;
  type: string;
  path: string;
  visible: boolean;
  bounds: FigmaBounds | null;
  layout: FigmaNodeLayout;
  component: {
    id: string | null;
    name: string | null;
    setId: string | null;
    setName: string | null;
    properties: FigmaComponentProperty[];
  };
  strokes: FigmaStroke[];
  children: FigmaLayerNode[];
}

export interface FigmaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaComponentProperty {
  name: string;
  type: string | null;
  value: string | boolean | number | null;
}

export interface FigmaNodeLayout {
  mode: string | null;
  primaryAxisSizingMode: string | null;
  counterAxisSizingMode: string | null;
  primaryAxisAlignItems: string | null;
  counterAxisAlignItems: string | null;
  itemSpacing: number | null;
  padding: {
    top: number | null;
    right: number | null;
    bottom: number | null;
    left: number | null;
  };
  layoutAlign: string | null;
  layoutGrow: number | null;
  constraints: {
    horizontal: string | null;
    vertical: string | null;
  };
}

export interface FigmaStroke {
  color: string;
  weight: number | null;
  align: string | null;
  sides: {
    top: number | null;
    right: number | null;
    bottom: number | null;
    left: number | null;
  };
}

export interface FigmaIconMeasurement {
  target: {
    id: string;
    name: string;
    type: string;
    bounds: FigmaBounds;
  };
  glyph: {
    id: string;
    name: string;
    type: string;
    bounds: FigmaBounds;
  };
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface FigmaExtractionCoverage {
  nodesVisited: number;
  nodesIncluded: number;
  nodesOmitted: number;
  nodesMissingGeometry: number;
  apiDepthLimited: boolean;
  normalizationTruncated: boolean;
}

export type FigmaDetectedControlType =
  | "radio-group"
  | "checkbox-group"
  | "dropdown"
  | "segmented-control"
  | "tabs"
  | "unknown-choice-group";

export type FigmaControlOrientation =
  | "vertical"
  | "horizontal"
  | "grid"
  | "unknown";

export interface FigmaDetectedControl {
  name: string;
  controlType: FigmaDetectedControlType;
  orientation: FigmaControlOrientation;
  optionCount: number;
  options: string[];
  confidence: "high" | "medium" | "low";
  evidence: string[];
  guidance: string;
}

export interface NormalizedFigmaContext {
  source: "live" | "mock";
  url: string;
  fileKey: string;
  nodeId: string | null;
  fileName: string;
  selectedNodeName: string;
  selectedNodeType: string;
  previewImageUrl: string | null;
  dimensions: {
    width: number | null;
    height: number | null;
  };
  layout: {
    mode: string | null;
    primaryAxisSizingMode: string | null;
    counterAxisSizingMode: string | null;
    itemSpacing: number | null;
    padding: {
      top: number | null;
      right: number | null;
      bottom: number | null;
      left: number | null;
    };
  };
  colors: FigmaColorToken[];
  text: FigmaTextNode[];
  radii: number[];
  implementationSummary: FigmaImplementationSummary;
  hierarchy: FigmaLayerNode[];
  detectedControls: FigmaDetectedControl[];
  iconMeasurements: FigmaIconMeasurement[];
  extractionCoverage: FigmaExtractionCoverage;
  implementationNotes: string[];
  ambiguityNotes: string[];
}

export interface FigmaExtractResponse {
  figma: NormalizedFigmaContext;
}

export type FigmaViewport = "desktop" | "mobile";

export interface PackagedFigmaContext {
  viewport: FigmaViewport;
  context: NormalizedFigmaContext;
}

export interface PackageAttachment {
  id: string;
  source: "jira" | "upload";
  filename: string;
  mimeType: string;
  size: number;
  data: Uint8Array;
  jiraAttachmentId: string | null;
  explanation: string;
}

export interface TicketToCodePackageInput {
  generatedAt: string;
  ticket: JiraTicketOption;
  editedDescription: string;
  figmaContexts: PackagedFigmaContext[];
  attachments: PackageAttachment[];
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

export type ValidationCommandResult =
  | "notRun"
  | "passed"
  | "failed"
  | "unknown";

export interface ValidationCommand {
  name: string;
  command: string;
  result: ValidationCommandResult;
  confidence?: "high" | "medium" | "low";
  summary?: string;
  reason?: string;
}

export interface RepositoryContext {
  packageManager: string | null;
  packageManagerName: "yarn" | "pnpm" | "npm" | null;
  detectedFiles: {
    packageJson: boolean;
    yarnLock: boolean;
    packageLock: boolean;
    pnpmLock: boolean;
    yarnrc: boolean;
    tsconfig: boolean;
    vitestConfig: boolean;
    jestConfig: boolean;
    playwrightConfig: boolean;
  };
  packageJson: {
    packageManager: string | null;
    scripts: Record<string, string>;
    dependencyNames: string[];
    devDependencyNames: string[];
  } | null;
  validationCommands: ValidationCommand[];
  suggestedFocusedCommands: ValidationCommand[];
  notes: string[];
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
  repositoryContext?: RepositoryContext;
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

export interface MergeRequestComment {
  id: string;
  discussionId: string;
  noteId: string;
  body: string;
  author: string;
  createdAt: string;
  filePath: string | null;
  lineNumber: number | null;
  resolvable: boolean;
  resolved: boolean;
  selected: boolean;
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

export interface LoadMrCommentsResponse {
  comments: MergeRequestComment[];
}

export interface PeerReviewFixesPackageInput {
  generatedAt: string;
  mergeRequest: MergeRequestContext;
  comments: MergeRequestComment[];
}

export type MergeRequestThreadStatus =
  | "resolved"
  | "unresolved"
  | "not-resolvable";

export interface MergeRequestThread {
  discussionId: string;
  comments: MergeRequestComment[];
  filePath: string | null;
  lineNumber: number | null;
  status: MergeRequestThreadStatus;
}

export interface ThreadResolutionPackageInput {
  generatedAt: string;
  mergeRequest: MergeRequestContext;
  comments: MergeRequestComment[];
}

export interface ReviewRequestPayload {
  mergeRequest: MergeRequestContext;
  jiraIssue: JiraIssue | null;
}

export interface PostCommentsPayload {
  mergeRequest: MergeRequestContext;
  findings: ReviewFinding[];
  jiraKey?: string;
  reviewDurationMs?: number;
}
