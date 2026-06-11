# Merge Medic AI

Merge Medic AI accepts a GitLab merge request URL or an open merge request selected from a project-scoped dropdown, loads merge request metadata and diffs, detects Jira keys, retrieves Jira issue context, generates structured review findings, lets the user edit and approve those findings, and posts approved comments back to GitLab.

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

# AI provider
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
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

Required for live review generation:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` recommended model: `gpt-5.5`
- `OPENAI_BASE_URL` optional, defaults to OpenAI chat completions

## Routes

- `POST /api/mr/load` loads merge request context and Jira key candidates
- `GET /api/mr/load` lists open merge requests for the configured GitLab group or project
- `POST /api/jira/resolve` loads a selected Jira issue
- `POST /api/review/generate` runs bounded retrieval and review generation
- `POST /api/comments/post` posts approved comments back to GitLab

## Notes

- Inline comment posting is attempted first and falls back to general MR notes when the finding cannot be safely anchored.
- Retrieval is intentionally bounded to changed files plus a small set of direct imports, likely tests, and shared support files.
