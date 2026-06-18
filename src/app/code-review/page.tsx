import type { Metadata } from "next";

import { ReviewDashboard } from "@/components/ReviewDashboard";

export const metadata: Metadata = {
  title: "Code Review | Workflow Apps",
  description:
    "Merge Medic AI code review workspace for GitLab merge requests and Jira context.",
};

export default function CodeReviewPage() {
  return <ReviewDashboard />;
}
