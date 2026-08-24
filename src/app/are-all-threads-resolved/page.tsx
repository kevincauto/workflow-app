import type { Metadata } from "next";

import { AllThreadsResolvedDashboard } from "@/components/AllThreadsResolvedDashboard";

export const metadata: Metadata = {
  title: "Are All Threads Resolved? | Workflow Apps",
  description:
    "Package GitLab discussions and merge request changes for evidence-based feedback verification and regression review.",
};

export default function AllThreadsResolvedPage() {
  return <AllThreadsResolvedDashboard />;
}
