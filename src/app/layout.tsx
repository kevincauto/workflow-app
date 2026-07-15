import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Workflow Apps",
  description:
    "A compact dashboard for internal workflow apps, including the Merge Medic AI code review workspace.",
};

function isDemoMode() {
  return !(
    process.env.GITLAB_TOKEN &&
    process.env.JIRA_BASE_URL &&
    process.env.JIRA_API_TOKEN &&
    process.env.AI_CENTER_HOST_URL &&
    process.env.AI_CENTER_API_KEY &&
    process.env.AI_CENTER_API_SECRET
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showDemoBanner = isDemoMode();

  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${monoFont.variable}`}>
        {showDemoBanner ? (
          <div className="border-b border-orange-100/50 bg-[linear-gradient(180deg,#fed7aa_0%,#fb923c_100%)] px-4 py-3 text-center text-sm font-bold text-slate-950 shadow-[0_16px_40px_rgba(251,146,60,0.22),inset_0_1px_0_rgba(255,255,255,0.65)] sm:text-base">
            Demo Mode: This site is not currently wired to live internal data or
            the AI Center Gateway.
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
