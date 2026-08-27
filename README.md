# Workflow App

Built from Merge Medic AI. Merge Medic AI accepts a GitLab merge request URL or an open merge request selected from a project-scoped dropdown, loads merge request metadata and diffs, detects Jira keys, retrieves Jira issue context, generates structured review findings, lets the user edit and approve those findings, and posts approved comments back to GitLab.

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS v4 utilities
- Server-side GitLab, Jira, and LLM integrations

## Local Development

These steps assume you are setting up the project on a work computer for the
first time.

### 1. Install the required tools

You need these installed before the app can run locally:

- **Git** for cloning the repository.
- **Node.js 20.9.0 or newer**. This project uses Next.js 16, which requires
  Node 20.9.0+.
- **npm**, which is included when you install Node.js.

If Node.js is not already installed, install the current Node.js LTS release
from your company software portal, your approved package manager, or
https://nodejs.org. After installing it, confirm that your terminal can see
Node and npm:

```bash
node --version
npm --version
```

`node --version` should print `v20.9.0` or newer.

### 2. Clone the repository

Clone the project from your Git provider, then move into the project folder:

```bash
git clone <repo-url>
cd merge-medic-ai
```

If you already cloned the repository, just open a terminal in the existing
`merge-medic-ai` folder.

### 3. Install project dependencies

Install the dependencies listed in `package-lock.json`:

```bash
npm ci
```

If `npm ci` fails because `package-lock.json` is out of sync, run
`npm install` instead and check with the project owner before committing any
lockfile changes.

### 4. Create your local environment file

Create a `.env.local` file in the project root. This file is ignored by Git and
must not be committed because it contains personal tokens.

Use this template and fill in your own token values:

```bash
# GitLab
GITLAB_TOKEN=
GITLAB_GROUP_ID=411
GITLAB_API_BASE_URL=https://gitlab.ftscc.net/api/v4
GITLAB_AUTH_MODE=private-token

# Jira
JIRA_BASE_URL=https://jira.ftscc.net
JIRA_API_TOKEN=
JIRA_AUTH_MODE=bearer
JIRA_API_VERSION=2
JIRA_BOARD_ID=
JIRA_ASSIGNEE_NAME=Kevin Cauto
JIRA_DEVELOPER_FIELD_NAME=Developer
JIRA_ESTIMATE_FIELD_ID=customfield_10016

# Aitrium (server-side only; do not use NEXT_PUBLIC_ prefixes)
AITRIUM_BASE_URL=
AITRIUM_API_TOKEN=
AITRIUM_PERSONA_ID=
AITRIUM_MODEL_ID=
AITRIUM_USER_TIMEZONE=America/New_York
```

You may need to be connected to the company VPN or org network for the app to
reach internal GitLab and Jira hosts.

### 5. Start the app

```bash
npm run dev
```

Open http://localhost:4000.

The app runs on port `4000` because the `dev` script is configured as
`next dev --port 4000`.

## Environment Variables

The app supports a resilient mock mode when integrations are not configured. That makes the dashboard demoable immediately.

Required for live GitLab loading and posting:

- `GITLAB_TOKEN`
- `GITLAB_GROUP_ID` for a group-wide open-MR dropdown, or `GITLAB_PROJECT_ID` for a single-project dropdown; pasted merge request URLs use the project path from the URL
- `GITLAB_API_BASE_URL` if your GitLab instance is not at `<host>/api/v4`

Optional GitLab auth settings:

- `GITLAB_AUTH_MODE` optional, supports `auto`, `private-token`, or `bearer`

Required for live Jira lookup:

- `JIRA_BASE_URL`
- `JIRA_API_TOKEN`

Optional Jira auth settings:

- `JIRA_AUTH_MODE` optional, supports `auto`, `bearer`, or `basic`
- `JIRA_EMAIL` optional, used for Atlassian Cloud or basic-auth Jira setups
- `JIRA_USERNAME` optional alternative to `JIRA_EMAIL` for internal Jira basic auth
- `JIRA_API_VERSION` optional, defaults to trying `2`, then `3`, then `latest`
- `JIRA_BOARD_ID` optional, used by Ticket to Code to order current and future sprint work
- `JIRA_ASSIGNEE_ACCOUNT_ID` optional, preferred when Jira supports account IDs
- `JIRA_ASSIGNEE_NAME` optional, used by Ticket to Code as the Jira user value for Assignee or Developer JQL matching
- `JIRA_DEVELOPER_FIELD_NAME` optional, defaults to `Developer` for Ticket to Code JQL matching
- `JIRA_DEVELOPER_FIELD_ID` optional, used to read the Developer display value when Jira returns it as a custom field ID
- `JIRA_ESTIMATE_FIELD_ID` optional, defaults to `customfield_10016` for Jira story point estimates; the app also auto-detects common Jira story point fields, and this value may be a comma-separated fallback list

Required for live review generation:

- `AITRIUM_BASE_URL` API origin only; the server appends `/v2/conversations/completion`
- `AITRIUM_API_TOKEN` personal access token, kept server-side
- `AITRIUM_PERSONA_ID`
- `AITRIUM_MODEL_ID`
- `AITRIUM_USER_TIMEZONE` optional, defaults to `America/New_York`

Do not copy browser cookies or use `NEXT_PUBLIC_` variables for Aitrium settings.

Optional AI demo mode:

- `AI_REVIEW_MOCK_MODE=true` enables deterministic demo review findings when Aitrium is not configured. Without this flag, `/api/review/generate` returns a configuration error instead of silently falling back to mock results.

## Routes

- `POST /api/mr/load` loads merge request context and Jira key candidates
- `GET /api/mr/load` lists open merge requests for the configured GitLab group or project
- `POST /api/jira/resolve` loads a selected Jira issue
- `GET /api/jira/attachments/[ticketKey]/[attachmentId]` securely proxies a validated Jira attachment for Ticket to Code previews and packaging
- `POST /api/review/generate` runs bounded retrieval and review generation
- `POST /api/comments/post` posts approved comments back to GitLab

## Ticket To Code Packages

Ticket to Code can include Jira attachments, browser-session file uploads, and up to two normalized Figma contexts. Jira credentials remain server-side; removing a Jira attachment from the page only excludes it from the current package and does not delete it from Jira.

Downloaded ZIP files contain the edited ticket requirements, an agent prompt, a manifest, selected files under `attachments/`, and one normalized JSON file per attached Figma viewport. Browser-session uploads are cleared when the selected ticket changes or the page is reloaded.

## Local Pilot Metrics Logging

Merge Medic AI records a local metrics entry after selected review comments are
successfully posted to GitLab. For localhost pilots, the log is stored on the
machine running `npm run dev` at:

`logs/merge-medic-review-log.jsonl`

The logger records:

- Merge request URL
- Repo metadata
- Count of high/medium/low findings generated by AI
- Count of high/medium/low findings posted to GitLab
- Posted findings as useful findings for pilot analysis

The logger intentionally does not store:

- Source code
- Full diffs
- Jira ticket descriptions
- Access tokens
- Full AI responses

To view pilot metrics:

```bash
npm run metrics:summary
```

To export CSV:

```bash
npm run metrics:summary:csv
```

## Notes

- Inline comment posting is attempted first and falls back to general MR notes when the finding cannot be safely anchored.
- Retrieval is intentionally bounded to changed files plus a small set of direct imports, likely tests, and shared support files.
