# Merge Medic AI

Hack Week MVP for reviewing a single known GitLab repository with assisted merge request analysis.

Merge Medic AI accepts a GitLab merge request URL or an open merge request selected from a project-scoped dropdown, loads merge request metadata and diffs, detects Jira keys, retrieves Jira issue context, generates structured review findings, lets the user edit and approve those findings, and posts approved comments back to GitLab.

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS v4 utilities
- Server-side GitLab, Jira, and LLM integrations

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and fill in the values you have available:

```bash
cp .env.example .env.local
```

3. Start the app:

```bash
npm run dev
```

Open http://localhost:3000.

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
- `OPENAI_MODEL` optional, defaults to `gpt-5.4-mini`
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
- The repo currently includes the original build plan in `merge-medic-ai-spec.md`.
