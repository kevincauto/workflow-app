import type { Metadata } from "next";

import { TicketToCodeDashboard } from "@/components/TicketToCodeDashboard";

export const metadata: Metadata = {
  title: "Ticket to Code | Workflow Apps",
  description:
    "Ticket to Code workflow for packaging Jira requirements and optional Figma context for feature creation.",
};

export default function TicketToCodePage() {
  return <TicketToCodeDashboard />;
}
