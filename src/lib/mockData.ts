import type {
  JiraIssue,
  MergeRequestComment,
  MergeRequestContext,
} from "@/lib/types";

export const mockMergeRequest: MergeRequestContext = {
  source: "mock",
  projectId: "demo-project",
  projectPath: "team/web-portal",
  projectName: "Web Portal",
  webUrl: "https://gitlab.example.com/team/web-portal/-/merge_requests/128",
  iid: "128",
  title: "CP2-1936 Guard customer profile fetch for missing account id",
  description:
    "Implements CP2-1936 by updating the customer profile page to handle partial route params and avoid broken fetches when the account id is missing.",
  author: "Taylor Dev",
  sourceBranch: "feature/CP2-1936-profile-guard",
  targetBranch: "main",
  repositoryContext: {
    packageManager: "yarn@4.9.1",
    packageManagerName: "yarn",
    detectedFiles: {
      packageJson: true,
      yarnLock: true,
      packageLock: false,
      pnpmLock: false,
      yarnrc: true,
      tsconfig: true,
      vitestConfig: true,
      jestConfig: false,
      playwrightConfig: false,
    },
    packageJson: {
      packageManager: "yarn@4.9.1",
      scripts: {
        lint: "eslint .",
        typecheck: "tsc --noEmit -p .",
        test: "vitest run",
        build: "vite build",
      },
      dependencyNames: ["@vitejs/plugin-react", "vite"],
      devDependencyNames: ["typescript", "vitest"],
    },
    validationCommands: [
      {
        name: "lint",
        command: "yarn lint",
        result: "notRun",
      },
      {
        name: "typecheck",
        command: "yarn typecheck",
        result: "notRun",
      },
      {
        name: "test",
        command: "yarn test",
        result: "notRun",
      },
      {
        name: "build",
        command: "yarn build",
        result: "notRun",
      },
    ],
    suggestedFocusedCommands: [],
    notes: [],
  },
  diffRefs: {
    baseSha: "1111111111111111111111111111111111111111",
    headSha: "2222222222222222222222222222222222222222",
    startSha: "1111111111111111111111111111111111111111",
  },
  changedFiles: [
    {
      oldPath: "src/pages/customer/ProfilePage.tsx",
      newPath: "src/pages/customer/ProfilePage.tsx",
      language: "tsx",
      isDeleted: false,
      isNew: false,
      isRenamed: false,
      isGenerated: false,
      diffCollapsed: false,
      diffTooLarge: false,
      content: `import { useEffect, useState } from "react";
import { fetchCustomerProfile } from "@/services/customerApi";

interface ProfilePageProps {
  routeSegments: string[];
}

export function ProfilePage({ routeSegments }: ProfilePageProps) {
  const [profile, setProfile] = useState<any>(null);
  const accountId = routeSegments[routeSegments.length - 2];

  useEffect(() => {
    async function loadProfile() {
      const data = await fetchCustomerProfile(accountId);
      setProfile(data);
    }

    loadProfile();
  }, [accountId]);

  if (!profile) {
    return <div>Loading customer profile...</div>;
  }

  return <section>{profile.name}</section>;
}
`,
      contentStatus: "available",
      contentError: null,
      diff: `@@ -4,13 +4,17 @@ interface ProfilePageProps {
 export function ProfilePage({ routeSegments }: ProfilePageProps) {
-  const [profile, setProfile] = useState<CustomerProfile | null>(null);
-  const accountId = routeSegments[routeSegments.length - 1];
+  const [profile, setProfile] = useState<any>(null);
+  const accountId = routeSegments[routeSegments.length - 2];
 
   useEffect(() => {
     async function loadProfile() {
-      const data = await fetchCustomerProfile(accountId);
+      const data = await fetchCustomerProfile(accountId);
       setProfile(data);
     }
 
     loadProfile();
   }, [accountId]);
+
+  console.log("loaded profile", profile);
 `,
    },
    {
      oldPath: "src/services/customerApi.ts",
      newPath: "src/services/customerApi.ts",
      language: "ts",
      isDeleted: false,
      isNew: false,
      isRenamed: false,
      isGenerated: false,
      diffCollapsed: false,
      diffTooLarge: false,
      content: [
        "export async function fetchCustomerProfile(accountId: string) {",
        "  const response = await fetch(`/api/customers/${accountId}`);",
        "  return response.json();",
        "}",
        "",
      ].join("\n"),
      contentStatus: "available",
      contentError: null,
      diff: [
        "@@ -1,3 +1,4 @@",
        " export async function fetchCustomerProfile(accountId: string) {",
        "   const response = await fetch(`/api/customers/${accountId}`);",
        "   return response.json();",
        " }",
        "",
      ].join("\n"),
    },
  ],
};

export const mockJiraIssue: JiraIssue = {
  key: "CP2-1936",
  summary: "Handle missing account id on customer profile routes",
  description:
    "Acceptance criteria:\n- Do not call the customer profile API when the account id route segment is missing.\n- Show a recoverable empty state instead of a broken loading screen.\n- Add regression coverage for short route paths.",
  webUrl: "https://jira.example.com/browse/CP2-1936",
  source: "mock",
};

export const mockMergeRequestComments: MergeRequestComment[] = [
  {
    id: "discussion-1-note-1",
    discussionId: "discussion-1",
    noteId: "note-1",
    body: "Can we avoid the `any` here and keep the customer profile state typed? This path touches account data, so the type guard would be helpful.",
    author: "Jordan Reviewer",
    createdAt: "2026-06-18T14:20:00.000Z",
    filePath: "src/pages/customer/ProfilePage.tsx",
    lineNumber: 9,
    resolvable: true,
    resolved: false,
    selected: false,
  },
  {
    id: "discussion-2-note-1",
    discussionId: "discussion-2",
    noteId: "note-1",
    body: "The route segment lookup changed from the final segment to the previous segment. Please confirm this matches the actual route shape and add coverage for the short-route case.",
    author: "Morgan QA",
    createdAt: "2026-06-18T14:35:00.000Z",
    filePath: "src/pages/customer/ProfilePage.tsx",
    lineNumber: 10,
    resolvable: true,
    resolved: false,
    selected: false,
  },
  {
    id: "discussion-3-note-1",
    discussionId: "discussion-3",
    noteId: "note-1",
    body: "General thought: this should probably show a recoverable empty state instead of staying on loading if the account id is missing.",
    author: "Casey Lead",
    createdAt: "2026-06-18T14:52:00.000Z",
    filePath: null,
    lineNumber: null,
    resolvable: false,
    resolved: false,
    selected: false,
  },
];
