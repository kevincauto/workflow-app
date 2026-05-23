import type { JiraIssue, MergeRequestContext } from "@/lib/types";

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
  source: "mock",
};
