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

function parsePositiveInt(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`${name} must be a positive integer.`);
    process.exit(1);
  }
  return parsed;
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

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, token, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      "PRIVATE-TOKEN": token,
    },
  });

  if (response.status === 429) {
    if (attempt > 5) {
      throw new Error("Rate limited too many times by GitLab.");
    }

    const retryAfter = Number(response.headers.get("retry-after") || "2");
    await sleep(retryAfter * 1000);
    return fetchJsonWithRetry(url, token, attempt + 1);
  }

  if (response.status === 401) {
    throw new Error("Unauthorized. Check your GitLab token.");
  }

  if (response.status === 403) {
    throw new Error("Forbidden. Your token may not have permission.");
  }

  if (response.status === 404) {
    throw new Error(
      "Not found. Check your GitLab host, group ID, or project ID.",
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitLab API error ${response.status}: ${body}`);
  }

  const json = await response.json();
  return { response, json };
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

    const { response, json } = await fetchJsonWithRetry(pagedUrl, token);

    if (!Array.isArray(json)) {
      throw new Error(
        `Expected array response from GitLab API for ${pagedUrl}`,
      );
    }

    results.push(...json);

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

async function getMergeRequestsForGroup({
  host,
  groupId,
  token,
  startDate,
  endDate,
}) {
  const encodedGroupId = encodeURIComponent(groupId);
  const url = `${host}/api/v4/groups/${encodedGroupId}/merge_requests`;

  return fetchAllPages(url, token, {
    state: "all",
    scope: "all",
    created_after: startDate.toISOString(),
    created_before: endDate.toISOString(),
    order_by: "created_at",
    sort: "asc",
  });
}

function summarizeMrsByProject(mrs) {
  const summaries = new Map();

  for (const mr of mrs) {
    const projectId = mr.project_id;

    if (!summaries.has(projectId)) {
      summaries.set(projectId, {
        total: 0,
        merged: 0,
        opened: 0,
        closed: 0,
      });
    }

    const summary = summaries.get(projectId);
    summary.total += 1;

    if (mr.state === "merged") summary.merged += 1;
    else if (mr.state === "opened") summary.opened += 1;
    else if (mr.state === "closed") summary.closed += 1;
  }

  return summaries;
}

function classifyRepoActivity({ lastActivityAt, startDate, mrCount }) {
  const isActiveByLastActivity =
    lastActivityAt instanceof Date &&
    !Number.isNaN(lastActivityAt.getTime()) &&
    lastActivityAt.getTime() >= startDate.getTime();

  const hasMrActivity = mrCount > 0;

  let activityStatus = "inactive";
  if (isActiveByLastActivity && hasMrActivity) {
    activityStatus = "active_recent_activity_and_mrs";
  } else if (isActiveByLastActivity) {
    activityStatus = "active_recent_activity_only";
  } else if (hasMrActivity) {
    activityStatus = "active_mr_activity_only";
  }

  return {
    isActiveByLastActivity,
    hasMrActivity,
    isActive: isActiveByLastActivity || hasMrActivity,
    activityStatus,
  };
}

function writeCsv(filename, rows) {
  const headers = [
    "project_id",
    "repo_name",
    "path_with_namespace",
    "last_activity_at",
    "is_active",
    "activity_status",
    "is_active_by_last_activity",
    "has_mr_activity",
    "mr_count_in_window",
    "merged_mrs",
    "open_mrs",
    "closed_without_merge_mrs",
    "web_url",
  ];

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(","),
    ),
  ].join("\n");

  fs.writeFileSync(filename, csv, "utf8");
}

async function main() {
  const token = process.env.GITLAB_TOKEN;

  if (!token) {
    console.error("");
    console.error("Missing GITLAB_TOKEN. Run this first:");
    console.error("");
    console.error('export GITLAB_TOKEN="paste_your_token_here"');
    console.error("");
    process.exit(1);
  }

  const host = requiredArg("--host").replace(/\/$/, "");
  const groupId = requiredArg("--group-id");
  const days = parsePositiveInt(getArg("--days") || "90", "--days");
  const includeInactive = getArg("--include-inactive") === "true";
  const csvFile =
    getArg("--csv") || `gitlab-repo-activity-last-${days}-days.csv`;

  const endDate = new Date();
  const startDate = daysAgoDate(days);

  console.log("");
  console.log(`Scanning GitLab group: ${groupId}`);
  console.log(`Host: ${host}`);
  console.log(`Window: last ${days} days`);
  console.log(`From: ${startDate.toISOString()}`);
  console.log(`To:   ${endDate.toISOString()}`);
  console.log(`Include inactive repos: ${includeInactive}`);
  console.log("");

  const projects = await getProjectsForGroup({ host, groupId, token });
  const mergeRequests = await getMergeRequestsForGroup({
    host,
    groupId,
    token,
    startDate,
    endDate,
  });

  console.log(
    `Found ${projects.length} non-archived projects visible to your token.`,
  );
  console.log(
    `Found ${mergeRequests.length} merge requests in the selected window.`,
  );
  console.log("");

  const mrSummaryByProject = summarizeMrsByProject(mergeRequests);

  let rows = projects.map((project) => {
    const lastActivityAt = project.last_activity_at
      ? new Date(project.last_activity_at)
      : null;

    const mrSummary = mrSummaryByProject.get(project.id) || {
      total: 0,
      merged: 0,
      opened: 0,
      closed: 0,
    };

    const activity = classifyRepoActivity({
      lastActivityAt,
      startDate,
      mrCount: mrSummary.total,
    });

    return {
      project_id: project.id,
      repo_name: project.name,
      path_with_namespace: project.path_with_namespace,
      last_activity_at: project.last_activity_at || "",
      is_active: activity.isActive,
      activity_status: activity.activityStatus,
      is_active_by_last_activity: activity.isActiveByLastActivity,
      has_mr_activity: activity.hasMrActivity,
      mr_count_in_window: mrSummary.total,
      merged_mrs: mrSummary.merged,
      open_mrs: mrSummary.opened,
      closed_without_merge_mrs: mrSummary.closed,
      web_url: project.web_url,
    };
  });

  if (!includeInactive) {
    rows = rows.filter((row) => row.is_active);
  }

  rows.sort((a, b) => {
    if (b.mr_count_in_window !== a.mr_count_in_window) {
      return b.mr_count_in_window - a.mr_count_in_window;
    }

    return String(b.last_activity_at).localeCompare(String(a.last_activity_at));
  });

  const totalMrs = rows.reduce((sum, row) => sum + row.mr_count_in_window, 0);
  const activeRepoCount = rows.filter((row) => row.is_active).length;

  console.log("Repo activity report:");
  console.log("");

  console.table(
    rows.map((row) => ({
      Repo: row.path_with_namespace,
      Status: row.activity_status,
      [`MRs last ${days} days`]: row.mr_count_in_window,
      Merged: row.merged_mrs,
      Open: row.open_mrs,
      Closed: row.closed_without_merge_mrs,
      "Last activity": row.last_activity_at,
    })),
  );

  console.log("");
  console.log(`Repos returned: ${rows.length}`);
  console.log(`Active repos in result set: ${activeRepoCount}`);
  console.log(
    `Total MRs across returned repos in last ${days} days: ${totalMrs}`,
  );
  console.log("");

  writeCsv(csvFile, rows);

  console.log(`CSV exported: ${csvFile}`);
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error(error.message);
  console.error("");
  process.exit(1);
});
