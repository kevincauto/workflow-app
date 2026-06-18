import type {
  ChangedFile,
  RepositoryContext,
  ValidationCommand,
} from "@/lib/types";

export const REPOSITORY_METADATA_FILE_PATHS = [
  "package.json",
  "yarn.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  ".yarnrc.yml",
  "tsconfig.json",
  "vitest.config.ts",
  "vitest.config.mts",
  "jest.config.js",
  "jest.config.ts",
  "playwright.config.ts",
] as const;

export type RepositoryMetadataFilePath =
  (typeof REPOSITORY_METADATA_FILE_PATHS)[number];

export type RepositoryMetadataFiles = Partial<
  Record<RepositoryMetadataFilePath, string | null>
>;

interface PackageJsonMetadata {
  packageManager: string | null;
  scripts: Record<string, string>;
  dependencyNames: string[];
  devDependencyNames: string[];
}

interface BuildRepositoryContextInput {
  metadataFiles: RepositoryMetadataFiles;
  changedFiles: ChangedFile[];
}

const VALIDATION_SCRIPT_NAMES = ["lint", "typecheck", "test", "build"];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringRecord(value: unknown): Record<string, string> {
  if (!isObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function parsePackageJson(content: string | null | undefined) {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as unknown;

    if (!isObject(parsed)) {
      return null;
    }

    const dependencies = getStringRecord(parsed.dependencies);
    const devDependencies = getStringRecord(parsed.devDependencies);

    return {
      packageManager:
        typeof parsed.packageManager === "string"
          ? parsed.packageManager
          : null,
      scripts: getStringRecord(parsed.scripts),
      dependencyNames: Object.keys(dependencies).sort(),
      devDependencyNames: Object.keys(devDependencies).sort(),
    } satisfies PackageJsonMetadata;
  } catch {
    return null;
  }
}

function getDetectedFiles(metadataFiles: RepositoryMetadataFiles) {
  return {
    packageJson: Boolean(metadataFiles["package.json"]),
    yarnLock: Boolean(metadataFiles["yarn.lock"]),
    packageLock: Boolean(metadataFiles["package-lock.json"]),
    pnpmLock: Boolean(metadataFiles["pnpm-lock.yaml"]),
    yarnrc: Boolean(metadataFiles[".yarnrc.yml"]),
    tsconfig: Boolean(metadataFiles["tsconfig.json"]),
    vitestConfig: Boolean(
      metadataFiles["vitest.config.ts"] || metadataFiles["vitest.config.mts"],
    ),
    jestConfig: Boolean(
      metadataFiles["jest.config.js"] || metadataFiles["jest.config.ts"],
    ),
    playwrightConfig: Boolean(metadataFiles["playwright.config.ts"]),
  };
}

function getPackageManagerName(
  packageManager: string | null,
): RepositoryContext["packageManagerName"] {
  if (packageManager?.startsWith("yarn@")) {
    return "yarn";
  }

  if (packageManager?.startsWith("pnpm@")) {
    return "pnpm";
  }

  if (packageManager?.startsWith("npm@")) {
    return "npm";
  }

  return null;
}

function detectPackageManager(input: {
  packageJson: PackageJsonMetadata | null;
  detectedFiles: ReturnType<typeof getDetectedFiles>;
}): Pick<RepositoryContext, "packageManager" | "packageManagerName"> {
  const declaredPackageManager = input.packageJson?.packageManager ?? null;
  const declaredPackageManagerName = getPackageManagerName(
    declaredPackageManager,
  );

  if (declaredPackageManager && declaredPackageManagerName) {
    return {
      packageManager: declaredPackageManager,
      packageManagerName: declaredPackageManagerName,
    };
  }

  if (input.detectedFiles.yarnrc || input.detectedFiles.yarnLock) {
    return { packageManager: "yarn", packageManagerName: "yarn" };
  }

  if (input.detectedFiles.pnpmLock) {
    return { packageManager: "pnpm", packageManagerName: "pnpm" };
  }

  if (input.detectedFiles.packageLock) {
    return { packageManager: "npm", packageManagerName: "npm" };
  }

  if (input.detectedFiles.packageJson) {
    return { packageManager: "npm", packageManagerName: "npm" };
  }

  return { packageManager: null, packageManagerName: null };
}

function buildScriptCommand(
  packageManagerName: RepositoryContext["packageManagerName"],
  scriptName: string,
) {
  if (packageManagerName === "yarn") {
    return `yarn ${scriptName}`;
  }

  if (packageManagerName === "pnpm") {
    return `pnpm ${scriptName}`;
  }

  if (packageManagerName === "npm") {
    return `npm run ${scriptName}`;
  }

  return null;
}

function buildToolCommand(
  packageManagerName: RepositoryContext["packageManagerName"],
  toolCommand: string,
) {
  if (packageManagerName === "yarn") {
    return `yarn ${toolCommand}`;
  }

  if (packageManagerName === "pnpm") {
    return `pnpm exec ${toolCommand}`;
  }

  if (packageManagerName === "npm") {
    return `npx ${toolCommand}`;
  }

  return null;
}

function isWatchCommand(script: string) {
  return /(^|\s)(--watch|watch)(\s|$)/.test(script);
}

function buildOneShotTestCommand(input: {
  packageJson: PackageJsonMetadata;
  packageManagerName: RepositoryContext["packageManagerName"];
  script: string;
}) {
  if (!isWatchCommand(input.script)) {
    return buildScriptCommand(input.packageManagerName, "test");
  }

  if (scriptMentions(input.packageJson, "vitest")) {
    return buildToolCommand(input.packageManagerName, "vitest run");
  }

  if (scriptMentions(input.packageJson, "jest")) {
    return buildToolCommand(input.packageManagerName, "jest --runInBand");
  }

  return null;
}

function buildValidationCommands(input: {
  packageJson: PackageJsonMetadata | null;
  packageManagerName: RepositoryContext["packageManagerName"];
}) {
  if (!input.packageJson || !input.packageManagerName) {
    return [];
  }

  return VALIDATION_SCRIPT_NAMES.flatMap((scriptName) => {
    if (!input.packageJson?.scripts[scriptName]) {
      return [];
    }

    const script = input.packageJson.scripts[scriptName];
    const command =
      scriptName === "test"
        ? buildOneShotTestCommand({
            packageJson: input.packageJson,
            packageManagerName: input.packageManagerName,
            script,
          })
        : buildScriptCommand(input.packageManagerName, scriptName);

    return command
      ? [
          {
            name: scriptName,
            command,
            result: "notRun" as const,
            ...(scriptName === "test" && isWatchCommand(script)
              ? {
                  confidence: "high" as const,
                  reason:
                    "Converted from a watch-oriented test script to a one-shot command for agent execution.",
                }
              : {}),
          },
        ]
      : [];
  });
}

function hasPackage(
  packageJson: PackageJsonMetadata | null,
  packageName: string,
) {
  return Boolean(
    packageJson?.dependencyNames.includes(packageName) ||
    packageJson?.devDependencyNames.includes(packageName),
  );
}

function scriptMentions(packageJson: PackageJsonMetadata | null, text: string) {
  return Object.values(packageJson?.scripts ?? {}).some((script) =>
    script.includes(text),
  );
}

function isTestFile(filePath: string) {
  return (
    /(^|\/)(__tests__|tests?)\//.test(filePath) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(filePath)
  );
}

function getChangedTestPaths(changedFiles: ChangedFile[]) {
  return changedFiles
    .map((file) => file.newPath)
    .filter((filePath) => filePath && isTestFile(filePath));
}

function getChangedTestFiles(changedFiles: ChangedFile[]) {
  return changedFiles.filter((file) => isTestFile(file.newPath));
}

function testFilesUseVitest(changedFiles: ChangedFile[]) {
  return getChangedTestFiles(changedFiles).some((file) =>
    /from\s+["']vitest["']|import\s+["']vitest["']/.test(file.content),
  );
}

function testFilesUseJest(changedFiles: ChangedFile[]) {
  return getChangedTestFiles(changedFiles).some((file) =>
    /from\s+["']@jest\/globals["']|import\s+["']@jest\/globals["']/.test(
      file.content,
    ),
  );
}

function buildFocusedCommands(input: {
  packageJson: PackageJsonMetadata | null;
  packageManagerName: RepositoryContext["packageManagerName"];
  detectedFiles: ReturnType<typeof getDetectedFiles>;
  changedFiles: ChangedFile[];
}) {
  const changedTestPaths = getChangedTestPaths(input.changedFiles);

  if (changedTestPaths.length === 0 || !input.packageManagerName) {
    return [];
  }

  const quotedPaths = changedTestPaths.map((filePath) =>
    JSON.stringify(filePath),
  );
  const commands: ValidationCommand[] = [];
  const changedTestsUseVitest = testFilesUseVitest(input.changedFiles);
  const changedTestsUseJest = testFilesUseJest(input.changedFiles);
  const hasVitest =
    changedTestsUseVitest ||
    input.detectedFiles.vitestConfig ||
    hasPackage(input.packageJson, "vitest") ||
    scriptMentions(input.packageJson, "vitest");
  const hasJest =
    changedTestsUseJest ||
    input.detectedFiles.jestConfig ||
    scriptMentions(input.packageJson, "jest");
  const hasPlaywright =
    input.detectedFiles.playwrightConfig ||
    hasPackage(input.packageJson, "@playwright/test") ||
    scriptMentions(input.packageJson, "playwright");

  if (hasVitest) {
    const command = buildToolCommand(
      input.packageManagerName,
      `vitest run ${quotedPaths.join(" ")} --reporter verbose`,
    );

    if (command) {
      commands.push({
        name: "focused-tests",
        command,
        result: "notRun",
        confidence: changedTestsUseVitest ? "high" : "medium",
        reason: changedTestsUseVitest
          ? "Changed test files use Vitest imports."
          : "Suggested from changed test files and detected Vitest setup.",
      });
    }
  }

  if (hasJest) {
    const command = buildToolCommand(
      input.packageManagerName,
      `jest ${quotedPaths.join(" ")}`,
    );

    if (command) {
      commands.push({
        name: "focused-tests",
        command,
        result: "notRun",
        confidence:
          changedTestsUseJest || input.detectedFiles.jestConfig
            ? "high"
            : "medium",
        reason: changedTestsUseJest
          ? "Changed test files use Jest imports."
          : "Suggested from changed test files and detected Jest setup.",
      });
    }
  }

  if (hasPlaywright) {
    const command = buildToolCommand(
      input.packageManagerName,
      `playwright test ${quotedPaths.join(" ")}`,
    );

    if (command) {
      commands.push({
        name: "focused-browser-tests",
        command,
        result: "notRun",
        reason:
          "Suggested from changed test files and detected Playwright setup.",
      });
    }
  }

  return commands;
}

export function buildRepositoryContext(
  input: BuildRepositoryContextInput,
): RepositoryContext {
  const packageJson = parsePackageJson(input.metadataFiles["package.json"]);
  const detectedFiles = getDetectedFiles(input.metadataFiles);
  const packageManager = detectPackageManager({ packageJson, detectedFiles });
  const validationCommands = buildValidationCommands({
    packageJson,
    packageManagerName: packageManager.packageManagerName,
  });
  const suggestedFocusedCommands = buildFocusedCommands({
    packageJson,
    packageManagerName: packageManager.packageManagerName,
    detectedFiles,
    changedFiles: input.changedFiles,
  });
  const notes: string[] = [];

  if (!detectedFiles.packageJson) {
    notes.push("No package.json was available from the target GitLab branch.");
  }

  if (detectedFiles.packageJson && validationCommands.length === 0) {
    notes.push(
      "No lint, typecheck, test, or build scripts were found in the target package.json.",
    );
  }

  if (!packageManager.packageManagerName) {
    notes.push(
      "No package manager could be inferred from target repo metadata.",
    );
  }

  return {
    ...packageManager,
    detectedFiles,
    packageJson,
    validationCommands,
    suggestedFocusedCommands,
    notes,
  };
}
