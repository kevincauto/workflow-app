# Hack Week Build Spec: Merge Medic AI

## Project Overview

Build a web application for a single known GitLab repository that helps a developer review GitLab merge requests using AI.

The app should allow a user to paste a GitLab merge request URL, fetch the merge request diff and related repository context, fetch related Jira ticket context, generate high-value AI review comments, allow the user to edit/approve/reject those comments, and then post approved comments directly into GitLab as merge request comments.

This is a single-user Hack Week MVP designed for a polished demo, but it should be structured cleanly enough that it could evolve into a production-quality internal tool.

## Primary Goal

Given a real GitLab merge request URL, generate approximately 3 to 10 useful review comments for approval, with strong preference for line-level comments attached to the correct diff lines in GitLab.

## Product Goals

1. Accept a GitLab merge request URL
2. Retrieve merge request metadata, changed files, and diffs
3. Retrieve full contents of changed files
4. Retrieve bounded related-file context from the repository
5. Extract Jira ticket key from merge request metadata
6. Retrieve Jira issue description and use it as acceptance-criteria context
7. Generate high-value AI review suggestions
8. Show comments in a polished review UI
9. Allow the user to edit, approve, or reject each comment
10. Post approved comments directly to GitLab
11. Prefer exact diff-line comments; fall back to file-level or top-level comments when necessary

---

## Scope

### In Scope

- Single known GitLab repository
- Single-user workflow
- React / TypeScript codebase
- GitLab merge request URL input
- Jira ticket context pulled from ticket description
- AI-generated review comments
- Inline comment approval/edit workflow
- Direct posting to GitLab comments
- Hosted demo capability if feasible
- Local development and local demo support

### Out of Scope

- Multi-user auth
- Organization-wide rollout
- True GitLab "pending review" or "start review" draft API integration
- Full repo indexing or vector database
- Embeddings-based retrieval
- Browser extension
- CI automation
- Auto-posting without user approval

---

## Success Criteria

The MVP is successful if:

1. A user pastes a real GitLab merge request URL
2. The app fetches merge request data and related Jira context
3. The app generates 3 to 10 high-value review suggestions
4. Most useful comments are mapped to exact diff lines when possible
5. The user can edit and approve comments in the app
6. Approved comments are posted directly into GitLab
7. Unmappable findings fall back cleanly to file-level or top-level merge request comments
8. The overall demo feels polished and credible

---

## High-Level User Flow

1. User opens the app
2. User pastes a GitLab merge request URL
3. App fetches merge request metadata
4. App fetches changed files and diffs
5. App extracts candidate Jira issue keys from:
   - merge request description
   - source branch name
   - merge request title
6. If multiple Jira keys are found, prompt the user to choose one
7. App fetches Jira issue details
8. App displays Jira description / acceptance context
9. User clicks "Generate Review"
10. App gathers repo context:
    - changed files
    - direct local imports
    - likely tests
    - related types/interfaces/utilities
11. App performs AI review generation
12. App displays grouped review comments
13. User edits/approves/rejects individual comments
14. User clicks "Post Approved Comments"
15. App posts approved comments to GitLab
16. App shows posting results and failures clearly

---

## Recommended Tech Stack

- **Framework:** Next.js
- **Language:** TypeScript
- **Frontend:** React
- **Server logic:** Next.js route handlers / server-side functions
- **Styling:** simple modern UI approach; use whatever is fastest and cleanest
- **LLM integration:** provider-agnostic service wrapper
- **Deployment target:** local-first, optionally deployable to Vercel or approved hosting
- **Secrets:** environment variables only for MVP

---

## Architecture Principles

1. Keep secrets server-side
2. Keep GitLab and Jira API calls server-side
3. Keep AI prompt construction server-side
4. Keep the UI focused on review, editing, approval, and posting
5. Separate:
   - integration logic
   - retrieval/context logic
   - prompt generation logic
   - UI rendering logic
6. Prefer deterministic heuristics over overly complex agent orchestration
7. Support one optional second-pass retrieval step for additional context

---

## Core Features

### 1. Merge Request Input

Provide a form that accepts a GitLab merge request URL.

Required behavior:

- Validate URL shape
- Parse project/repository path if needed
- Parse merge request IID/ID if needed
- Show clear error state for invalid URLs

### 2. GitLab Merge Request Retrieval

Fetch:

- merge request title
- description
- source branch
- target branch
- author
- project info
- changed files
- diff hunks
- enough metadata to support inline comment posting

Also fetch full file contents for changed files.

### 3. Jira Key Detection

Extract candidate Jira keys from:

- merge request description
- source branch name
- merge request title

Use a ticket-key pattern such as uppercase-project-key followed by dash and number.

Examples:

- `CP2-1936`
- `ABC-102`

If exactly one Jira key is found:

- use it automatically

If multiple are found:

- prompt user to choose one

If none are found:

- continue without Jira context, but show that Jira context is unavailable

### 4. Jira Context Retrieval

Fetch Jira issue details for the selected key.

For MVP, treat the Jira description as the primary requirement/acceptance-criteria context.

Display:

- ticket key
- summary
- description

The UI should make this context visible before review generation.

### 5. Context Retrieval for AI Review

The AI should not receive the whole repository.

Use bounded retrieval.

#### First-pass context

Always include:

- merge request title
- merge request description
- selected Jira summary
- selected Jira description
- changed file paths
- diff hunks
- full contents of changed files

#### Additional related-file retrieval

Include:

- direct local imports from changed files
- likely colocated or sibling test files
- shared local type/interface files
- obvious related utility or hook files referenced by changed files

Apply limits to avoid excessive context size.

#### Optional second pass

After first-pass context is assembled, allow one optional second retrieval step:

- the review engine may request up to 3 additional file paths
- fetch those files
- include them in the final AI review call

If a requested file is missing or invalid, continue gracefully.

---

## Retrieval Heuristics

Implement practical heuristics for a React / TypeScript repository.

Prioritize:

1. changed files
2. direct local imports from changed files
3. related test files
4. shared types/interfaces
5. shared hooks/utilities directly referenced

Possible patterns to support:

- `Component.tsx` -> `Component.test.tsx`
- sibling `__tests__` files
- shared `types.ts`
- shared hooks such as `useSomething.ts`
- local alias imports if repo config supports them

Do not recurse deeply through the repo.
Keep retrieval bounded and predictable.

---

## AI Review Requirements

The AI should act like a strong senior reviewer focused on high-value issues.

### Prioritized review categories

- Bug
- Logic
- Security
- Error Handling
- Test Gap
- Jira Mismatch
- Maintainability
- Performance

### Prioritized behavior

- Prefer fewer, stronger comments
- Avoid style nitpicks
- Avoid formatting comments
- Avoid speculative comments without evidence
- Comment on changed lines when possible
- Comment on impacted unchanged code only when the issue is important
- Use Jira context to identify mismatch with requirements
- Be conservative and useful

### Expected output count

Target:

- 3 to 7 comments usually
  Allowed max:
- 10 comments

### Severity levels

- High
- Medium
- Low

---

## AI Output Schema

The review engine should return structured JSON.

Each finding should include:

- `filePath`: string or null
- `lineStart`: number or null
- `lineEnd`: number or null
- `severity`: `"High" | "Medium" | "Low"`
- `category`: one of the approved review categories
- `commentText`: concise final review text intended for GitLab
- `rationale`: internal explanation shown only in the app
- `isGeneralComment`: boolean
- `codeSnippet`: optional short snippet for display in UI

### Notes

- `commentText` should be concise and directly usable in GitLab
- `rationale` should help the user decide whether to approve
- Do not include rationale in the posted GitLab comment
- Omit confidence scoring in MVP

---

## GitLab Comment Posting Rules

### Preferred posting behavior

Post approved comments as inline merge request comments attached to the correct diff line whenever possible.

### Inline mapping rules

- Prefer exact diff line mapping
- If GitLab supports line ranges, use line range when appropriate
- Otherwise anchor to the first relevant changed line
- If exact line mapping is not reliable, fall back to file-level comment
- If file-level comment is not feasible, fall back to top-level merge request comment

### Posted comment format

Post only the concise review text.

Example:
`This branch assumes the URL always contains a doc ID segment. Consider guarding against shorter paths before accessing the second-to-last segment.`

Do not include rationale in posted comments.

### Posting workflow

- Only user-approved comments may be posted
- Posting should happen in a batch action from the UI
- After posting, display success/failure status for each comment

---

## Review Summary

Generate a short summary for display in the app.

Possible contents:

- overall review assessment
- number of generated findings
- key Jira alignment concerns
- suggested testing focus

This summary should be shown in the UI.
Do not auto-post the summary to GitLab in MVP.

---

## UI Requirements

Build a polished single-page dashboard.

### Main sections

#### 1. Merge Request Input Panel

- MR URL input
- load button
- validation/error state

#### 2. Merge Request Context Panel

Display:

- title
- description
- source branch
- target branch
- repo/project info
- changed files count

#### 3. Jira Context Panel

Display:

- Jira key
- Jira summary
- Jira description / acceptance criteria context
- Jira key chooser if multiple keys found

#### 4. Review Generation Controls

- generate review button
- loading state
- option to regenerate if needed

#### 5. Review Results Panel

Show generated findings grouped by file.

Each finding should show:

- file path
- line or line range if present
- severity
- category
- concise comment text in editable text area/input
- rationale in expandable section
- diff/code snippet if available
- approve toggle
- reject toggle or deselect option

#### 6. Posting Panel

- post approved comments button
- per-comment posting status
- overall success/error summary

---

## UX Behavior

- Users must be able to edit the final comment text before posting
- Users must explicitly approve comments before posting
- Comments should default to selectable but still reviewable
- Make it easy to skip weak comments
- Show enough code context to make approval decisions fast
- Do not block the whole flow if Jira is unavailable
- Do not block the whole flow if a subset of comments fail to post

---

## Suggested Prompting Strategy

### System-level instructions

The model should be instructed to:

- review code like a senior engineer
- focus on correctness, logic, security, error handling, tests, and Jira requirement alignment
- avoid style-only comments
- avoid low-value or speculative comments
- produce only high-value, actionable findings
- return structured JSON only

### Review context should include

- merge request title and description
- Jira summary and description
- changed files and diffs
- full changed file contents
- selected related file contents
- any retrieval notes useful for reasoning

### Final prompt should explicitly ask the model to

- map each comment to the best target line when possible
- produce general comments only when line mapping is not appropriate
- keep the final comment text concise
- place detailed reasoning in rationale only

---

## Suggested Implementation Modules

Create code organized around these modules.

### `lib/gitlab.ts`

Responsibilities:

- parse merge request URL
- fetch merge request metadata
- fetch diffs
- fetch changed file contents
- fetch any metadata needed for inline comment positioning
- post inline comments
- post file-level or top-level comments

### `lib/jira.ts`

Responsibilities:

- extract Jira keys from text
- fetch Jira issue details
- normalize Jira description payload

### `lib/retrieval.ts`

Responsibilities:

- parse imports from changed files
- identify related tests
- identify related shared types/utilities/hooks
- enforce retrieval limits
- support optional second-pass file requests

### `lib/prompt.ts`

Responsibilities:

- assemble structured review prompt
- define schema for AI output
- provide category/severity constraints

### `lib/ai.ts`

Responsibilities:

- call approved LLM endpoint
- validate structured response
- coerce or reject malformed output

### `lib/lineMapping.ts`

Responsibilities:

- map AI findings to diff line positions
- support exact line mapping
- support file-level fallback
- support top-level fallback

### `lib/types.ts`

Responsibilities:

- shared app types
- review finding types
- GitLab/Jira response types

---

## Suggested Route Structure

Use Next.js app router and route handlers.

Example structure:

```text
app/
  page.tsx
  api/
    mr/
      load/route.ts
    jira/
      resolve/route.ts
    review/
      generate/route.ts
    comments/
      post/route.ts
components/
  MrUrlForm.tsx
  MrDetailsCard.tsx
  JiraPanel.tsx
  ReviewControls.tsx
  ReviewSummary.tsx
  FindingCard.tsx
  FindingsList.tsx
  PostResultsPanel.tsx
lib/
  gitlab.ts
  jira.ts
  retrieval.ts
  prompt.ts
  ai.ts
  lineMapping.ts
  types.ts
```
