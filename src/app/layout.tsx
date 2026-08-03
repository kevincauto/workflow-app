import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Workflow Apps",
  description:
    "A compact dashboard for internal workflow apps, including the Merge Medic AI code review workspace.",
};

function getMissingLiveConfig() {
  return [
    ["GITLAB_TOKEN", process.env.GITLAB_TOKEN],
    ["JIRA_BASE_URL", process.env.JIRA_BASE_URL],
    ["JIRA_API_TOKEN", process.env.JIRA_API_TOKEN],
    ["OPENAI_API_KEY", process.env.OPENAI_API_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const missingLiveConfig = getMissingLiveConfig();
  const showDemoBanner = missingLiveConfig.length > 0;

  return (
    <html lang="en">
      <body>
        {showDemoBanner ? (
          <div className="border-b border-orange-100/50 bg-[linear-gradient(180deg,#fed7aa_0%,#fb923c_100%)] px-4 py-3 text-center text-sm font-bold text-slate-950 shadow-[0_16px_40px_rgba(251,146,60,0.22),inset_0_1px_0_rgba(255,255,255,0.65)] sm:text-base">
            Demo Mode: This site is not currently wired to live internal data or
            the OpenAI API. Missing: {missingLiveConfig.join(", ")}.
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
