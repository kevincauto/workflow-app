import fs from "node:fs";
import path from "node:path";

const logFilePath = path.join(
  process.cwd(),
  "logs",
  "merge-medic-review-log.jsonl",
);
const csvFilePath = path.join(
  process.cwd(),
  "logs",
  "merge-medic-pilot-summary.csv",
);

const countFields = [
  "generatedHighCount",
  "generatedMediumCount",
  "generatedLowCount",
  "generatedTotalCount",
  "postedHighCount",
  "postedMediumCount",
  "postedLowCount",
  "postedTotalCount",
  "usefulHighCount",
  "usefulMediumCount",
  "usefulLowCount",
  "usefulTotalCount",
];

function readLogEntries() {
  let contents = "";

  try {
    contents = fs.readFileSync(logFilePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return contents
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line, index) => {
      try {
        return [JSON.parse(line)];
      } catch (error) {
        console.warn(`Skipping invalid JSONL line ${index + 1}:`, error);
        return [];
      }
    });
}

function numberValue(entry, field) {
  return typeof entry[field] === "number" ? entry[field] : 0;
}

function createEmptyAggregate(repoName = "") {
  return {
    repoName,
    reviewsLogged: 0,
    mrsWithGeneratedHighOrMedium: 0,
    mrsWithPostedHighOrMedium: 0,
    generatedHighCount: 0,
    generatedMediumCount: 0,
    generatedLowCount: 0,
    generatedTotalCount: 0,
    postedHighCount: 0,
    postedMediumCount: 0,
    postedLowCount: 0,
    postedTotalCount: 0,
    usefulHighCount: 0,
    usefulMediumCount: 0,
    usefulLowCount: 0,
    usefulTotalCount: 0,
  };
}

function addEntryToAggregate(aggregate, entry) {
  aggregate.reviewsLogged += 1;

  for (const field of countFields) {
    aggregate[field] += numberValue(entry, field);
  }

  if (entry.hasGeneratedHighOrMediumFinding) {
    aggregate.mrsWithGeneratedHighOrMedium += 1;
  }

  if (entry.hasPostedHighOrMediumFinding) {
    aggregate.mrsWithPostedHighOrMedium += 1;
  }
}

function formatRate(numerator, denominator) {
  if (denominator === 0) {
    return "0%";
  }

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatRatio(numerator, denominator) {
  return `${numerator} / ${denominator} (${formatRate(numerator, denominator)})`;
}

function getRepoName(entry) {
  return entry.repoName || entry.repoPath || "Unknown repo";
}

function aggregateEntries(entries) {
  const totals = createEmptyAggregate();
  const uniqueMergeRequests = new Set();
  const uniqueRepos = new Set();
  const repoBreakdown = new Map();

  for (const entry of entries) {
    addEntryToAggregate(totals, entry);

    if (entry.mergeRequestUrl) {
      uniqueMergeRequests.add(entry.mergeRequestUrl);
    }

    const repoName = getRepoName(entry);
    uniqueRepos.add(repoName);

    if (!repoBreakdown.has(repoName)) {
      repoBreakdown.set(repoName, createEmptyAggregate(repoName));
    }

    addEntryToAggregate(repoBreakdown.get(repoName), entry);
  }

  return {
    totals,
    uniqueMergeRequests,
    uniqueRepos,
    repoBreakdown: [...repoBreakdown.values()].sort((left, right) =>
      left.repoName.localeCompare(right.repoName),
    ),
  };
}

function printLine(columns, widths) {
  console.log(
    columns
      .map((column, index) => String(column).padEnd(widths[index], " "))
      .join("  ")
      .trimEnd(),
  );
}

function printRepoBreakdown(repoBreakdown) {
  console.log("Repo-level breakdown:");

  if (repoBreakdown.length === 0) {
    console.log("No repo metrics logged yet.");
    return;
  }

  const rows = repoBreakdown.map((repo) => [
    repo.repoName,
    repo.reviewsLogged,
    repo.generatedHighCount,
    repo.generatedMediumCount,
    repo.generatedLowCount,
    repo.postedHighCount,
    repo.postedMediumCount,
    repo.postedLowCount,
    formatRate(repo.mrsWithPostedHighOrMedium, repo.reviewsLogged),
  ]);
  const headers = [
    "Repo",
    "Reviews",
    "Gen High",
    "Gen Med",
    "Gen Low",
    "Posted High",
    "Posted Med",
    "Posted Low",
    "Useful H/M MR Rate",
  ];
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length)),
  );

  printLine(headers, widths);
  for (const row of rows) {
    printLine(row, widths);
  }
}

function csvEscape(value) {
  const stringValue = String(value ?? "");

  if (
    stringValue.includes(",") ||
    stringValue.includes("\"") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }

  return stringValue;
}

function exportCsv(repoBreakdown) {
  const headers = [
    "repoName",
    "reviewsLogged",
    "generatedHighCount",
    "generatedMediumCount",
    "generatedLowCount",
    "generatedTotalCount",
    "postedHighCount",
    "postedMediumCount",
    "postedLowCount",
    "postedTotalCount",
    "usefulHighCount",
    "usefulMediumCount",
    "usefulLowCount",
    "usefulTotalCount",
    "mrsWithGeneratedHighOrMedium",
    "mrsWithPostedHighOrMedium",
    "generatedHighMediumMrRate",
    "postedUsefulHighMediumMrRate",
    "selectionRate",
  ];

  const rows = repoBreakdown.map((repo) => [
    repo.repoName,
    repo.reviewsLogged,
    repo.generatedHighCount,
    repo.generatedMediumCount,
    repo.generatedLowCount,
    repo.generatedTotalCount,
    repo.postedHighCount,
    repo.postedMediumCount,
    repo.postedLowCount,
    repo.postedTotalCount,
    repo.usefulHighCount,
    repo.usefulMediumCount,
    repo.usefulLowCount,
    repo.usefulTotalCount,
    repo.mrsWithGeneratedHighOrMedium,
    repo.mrsWithPostedHighOrMedium,
    formatRate(repo.mrsWithGeneratedHighOrMedium, repo.reviewsLogged),
    formatRate(repo.mrsWithPostedHighOrMedium, repo.reviewsLogged),
    formatRate(repo.usefulTotalCount, repo.generatedTotalCount),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  fs.mkdirSync(path.dirname(csvFilePath), { recursive: true });
  fs.writeFileSync(csvFilePath, `${csv}\n`, "utf8");
  console.log(`CSV exported to ${csvFilePath}`);
}

function main() {
  const entries = readLogEntries();
  const { totals, uniqueMergeRequests, uniqueRepos, repoBreakdown } =
    aggregateEntries(entries);

  console.log("Merge Medic AI Pilot Summary");
  console.log("");
  console.log(`Reviews logged: ${totals.reviewsLogged}`);
  console.log(`Unique merge requests reviewed: ${uniqueMergeRequests.size}`);
  console.log(`Unique repos reviewed: ${uniqueRepos.size}`);
  console.log("");
  console.log("Generated findings:");
  console.log(`High: ${totals.generatedHighCount}`);
  console.log(`Medium: ${totals.generatedMediumCount}`);
  console.log(`Low: ${totals.generatedLowCount}`);
  console.log(`Total: ${totals.generatedTotalCount}`);
  console.log("");
  console.log("Posted / useful findings:");
  console.log(`High: ${totals.usefulHighCount}`);
  console.log(`Medium: ${totals.usefulMediumCount}`);
  console.log(`Low: ${totals.usefulLowCount}`);
  console.log(`Total: ${totals.usefulTotalCount}`);
  console.log("");
  console.log(
    `MRs with generated high/medium findings: ${totals.mrsWithGeneratedHighOrMedium}`,
  );
  console.log(
    `MRs with posted high/medium findings: ${totals.mrsWithPostedHighOrMedium}`,
  );
  console.log("");
  console.log(
    `Generated high/medium MR rate: ${totals.mrsWithGeneratedHighOrMedium} / ${totals.reviewsLogged}`,
  );
  console.log(
    `Posted useful high/medium MR rate: ${totals.mrsWithPostedHighOrMedium} / ${totals.reviewsLogged}`,
  );
  console.log("");
  console.log("Selection/usefulness rate:");
  console.log(
    `Posted useful findings / generated findings: ${formatRatio(
      totals.usefulTotalCount,
      totals.generatedTotalCount,
    )}`,
  );
  console.log("");
  printRepoBreakdown(repoBreakdown);

  if (process.argv.includes("--csv")) {
    console.log("");
    exportCsv(repoBreakdown);
  }
}

main();
