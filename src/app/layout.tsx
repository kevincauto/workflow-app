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
  title: "Merge Medic AI",
  description:
    "Merge Medic AI is a single-user dashboard for loading GitLab merge requests, enriching them with Jira context, generating review comments, and posting approved feedback back to GitLab.",
};

function isDemoMode() {
  return !(
    process.env.GITLAB_TOKEN &&
    process.env.JIRA_BASE_URL &&
    process.env.JIRA_API_TOKEN &&
    process.env.OPENAI_API_KEY
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
            Demo Mode: This site is not currently wired to live Fiserv data or
            the OpenAI SDK.
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
