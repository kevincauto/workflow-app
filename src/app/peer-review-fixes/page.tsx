import type { Metadata } from "next";

import { PeerReviewFixesDashboard } from "@/components/PeerReviewFixesDashboard";

export const metadata: Metadata = {
  title: "Peer Review Fixes | Workflow Apps",
  description:
    "Export selected merge request comments into a coding-agent prompt for peer review fixes.",
};

export default function PeerReviewFixesPage() {
  return <PeerReviewFixesDashboard />;
}
