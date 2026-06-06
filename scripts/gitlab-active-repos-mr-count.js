#!/usr/bin/env node

const fs = require("fs");

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

function requiredArg(name) {
  const value = getArg(name);
  if (!value) {
    console.error(`Missing required argument: ${name}`);
    process.exit(1);
  }
  return value;
}

function daysAgoDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

async function fetchAllPages(url, token, params = {}) {
  const results = [];
  let page = 1;

  while (true) {
    const pagedUrl = new URL(url);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        pagedUrl.searchParams.set(key, String(value));
      }
    }

    pagedUrl.searchParams.set("per_page", "100");
    pagedUrl.searchParams.set("page", String(page));

    const response = await fetch(pagedUrl, {
      headers: {
        "PRIVATE-TOKEN": token,
      },
    });

    if (response.status === 401) {
      throw new Error("Unauthorized. Check your GitLab token.");
    }

    if (response.status === 403) {
      throw new Error("Forbidden. Your token may not have permission.");
    }

    if (response.status === 404) {
      throw new Error("Not found. Check your GitLab host, group ID, or project ID.");
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitLab API error ${response.status}: ${body}`);
    }

    const items = await response.json();
    results.push(...items);

    const nextPage = response.headers.get("x-next-page");
    if (!nextPage) break;

    page = Number(nextPage);
  }

  return results;
}

async function getProjectsForGroup({ host, groupId, token }) {
  const encodedGroupId = encodeURIComponent(groupId);
  const url = `${host}/api/v4/groups/${encodedGroupId}/projects`;

  return fetchAllPages(url, token, {
    include_subgroups: "true",
    archived: "false",
    simple: "true",
    order_by: "last_activity_at",
    sort: "desc",
  });
}

async function getMergeRequestsForProject({ host, projectId, token, startDate, endDate }) {
  const encodedProjectId = encodeURIComponent(projectId);
  const url = `${host}/api/v4/projects/${encodedProjectId}/merge_requests`;

  return fetchAllPages(url, token, {
    state: "all",
    scope: "all",
    created_after: startDate.toISOString(),
    created_before: endDate.toISOString(),
    order_by: "created_at",
    sort: "asc",
  });
}

function summarizeMrs(mrs) {
  const summary = {
    total: mrs.length,
    merged: 0,
    opened: 0,
    closed: 0,
  };

  for (const mr of mrs) {
    if (mr.state === "merged") summary.merged += 1;
    else if (mr.state === "opened") summary.opened += 1;
    else if (mr.state === "closed") summary.closed += 1;
  }

  return summary;
}

function writeCsv(filename, rows) {
  const headers = [
    "project_id",
    "repo_name",
    "path_with_namespace",
    "last_activity_at",
    "mr_count_last_90_days",
    "merged_mrs",
    "open_mrs",
    "closed_without_merge_mrs",
    "web_url",
  ];

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(",")
    ),
  ].join("\n");

  fs.writeFileSync(filename, csv, "utf8");
}

async function main() {
  const token = process.env.GITLAB_TOKEN;

  if (!token) {
    console.error("");
    console.error('Missing GITLAB_TOKEN. Run this first:');
    console.error('');
    console.error('export GITLAB_TOKEN="paste_your_token_here"');
    console.error("");
    process.exit(1);
  }

  const host = requiredArg("--host").replace(/\/$/, "");
  const groupId = requiredArg("--group-id");
  const days = Number(getArg("--days") || "90");
  const csvFile = getArg("--csv") || `gitlab-active-repos-mrs-last-${days}-days.csv`;

  const endDate = new Date();
  const startDate = daysAgoDate(days);

  console.log("");
  console.log(`Scanning GitLab group: ${groupId}`);
  console.log(`Host: ${host}`);
  console.log(`Window: last ${days} days`);
  console.log(`From: ${startDate.toISOString()}`);
  console.log(`To:   ${endDate.toISOString()}`);
  console.log("");

  const projects = await getProjectsForGroup({ host, groupId, token });

  console.log(`Found ${projects.length} non-archived projects visible to your token.`);
  console.log("Counting merge requests per active repo...");
  console.log("");

  const activeRows = [];

  for (const project of projects) {
    const lastActivityAt = project.last_activity_at
      ? new Date(project.last_activity_at)
      : null;

    const isActive =
      lastActivityAt && lastActivityAt.getTime() >= startDate.getTime();

    if (!isActive) {
      continue;
    }

    const mrs = await getMergeRequestsForProject({
      host,
      projectId: project.id,
      token,
      startDate,
      endDate,
    });

    const mrSummary = summarizeMrs(mrs);

    activeRows.push({
      project_id: project.id,
      repo_name: project.name,
      path_with_namespace: project.path_with_namespace,
      last_activity_at: project.last_activity_at,
      mr_count_last_90_days: mrSummary.total,
      merged_mrs: mrSummary.merged,
      open_mrs: mrSummary.opened,
      closed_without_merge_mrs: mrSummary.closed,
      web_url: project.web_url,
    });
  }

  activeRows.sort(
    (a, b) => b.mr_count_last_90_days - a.mr_count_last_90_days
  );

  const totalMrs = activeRows.reduce(
    (sum, row) => sum + row.mr_count_last_90_days,
    0
  );

  console.log("Active repos and MR counts:");
  console.log("");

  console.table(
    activeRows.map((row) => ({
      Repo: row.path_with_namespace,
      "MRs last 90 days": row.mr_count_last_90_days,
      Merged: row.merged_mrs,
      Open: row.open_mrs,
      Closed: row.closed_without_merge_mrs,
      "Last activity": row.last_activity_at,
    }))
  );

  console.log("");
  console.log(`Active repos found: ${activeRows.length}`);
  console.log(`Total MRs across active repos in last ${days} days: ${totalMrs}`);
  console.log("");

  writeCsv(csvFile, activeRows);

  console.log(`CSV exported: ${csvFile}`);
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error(error.message);
  console.error("");
  process.exit(1);
});