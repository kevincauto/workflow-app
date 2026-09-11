import type { Metadata } from "next";

import { TicketToCodeDashboard } from "@/components/TicketToCodeDashboard";

export const metadata: Metadata = {
  title: "Code Hero | Workflow Apps",
  description:
    "Code Hero packages Jira requirements and optional Figma context for feature creation.",
};

export default function CodeHeroPage() {
  return <TicketToCodeDashboard />;
}
