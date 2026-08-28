import Link from "next/link";

import { HomeJiraTickets } from "@/components/HomeJiraTickets";

type WorkflowApp =
  | {
      name: string;
      description: string;
      href: string;
      action: string;
      status: "Ready" | "Planned";
      accent: string;
      active: true;
    }
  | {
      name: string;
      description: string;
      action: string;
      status: "Ready" | "Planned";
      accent: string;
      active: false;
    };

const workflowApps: WorkflowApp[] = [
  {
    name: "Code Hero",
    description:
      "Turn ticket context, requirements, and acceptance criteria into a focused implementation starting point.",
    href: "/ticket-to-code",
    action: "Code Creation",
    status: "Ready",
    accent: "from-violet-500 to-fuchsia-600",
    active: true,
  },
  {
    name: "Merge Medic AI",
    description:
      "Load GitLab merge requests, add Jira context, generate review comments, and post approved feedback.",
    href: "/code-review",
    action: "Code Review",
    status: "Ready",
    accent: "from-cyan-500 to-blue-600",
    active: true,
  },
  {
    name: "Peer Review Fixes",
    description:
      "Collect colleague merge request comments and export a focused fix-up prompt for a coding agent.",
    href: "/peer-review-fixes",
    action: "Fix-Up Code",
    status: "Ready",
    accent: "from-emerald-400 to-teal-600",
    active: true,
  },
  {
    name: "Are All Threads Resolved?",
    description:
      "Verify every GitLab discussion against the current code and check the merge request for remaining issues or regressions.",
    href: "/are-all-threads-resolved",
    action: "Verify Feedback",
    status: "Ready",
    accent: "from-amber-400 to-rose-500",
    active: true,
  },
];

export default function Home() {
  const readyCount = workflowApps.filter(
    (app) => app.status === "Ready",
  ).length;
  const plannedCount = workflowApps.filter(
    (app) => app.status === "Planned",
  ).length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,rgba(14,165,233,0.32),transparent_26%),radial-gradient(circle_at_84%_10%,rgba(168,85,247,0.26),transparent_24%),radial-gradient(circle_at_72%_70%,rgba(16,185,129,0.24),transparent_28%),linear-gradient(145deg,#202c40_0%,#324158_46%,#2a384d_100%)] px-4 py-8 text-slate-50 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-lg border border-white/12 bg-slate-950/55 px-5 py-5 shadow-[0_28px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                Workflow Apps
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                Internal Workflow Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                A launch point for focused tools that handle repeatable review,
                delivery, and implementation follow-up work.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-white/10 bg-white/6 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:min-w-90">
              <div>
                <p className="text-2xl font-semibold text-white">
                  {readyCount}
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                  Ready
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">
                  {plannedCount}
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                  Planned
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">
                  {workflowApps.length}
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                  Apps
                </p>
              </div>
            </div>
          </div>
        </header>

        <section aria-labelledby="workflow-apps-title" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="workflow-apps-title"
                className="text-xl font-semibold text-white"
              >
                Available Workflows
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Pick the workflow that matches the next review or delivery task.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflowApps.map((app) => (
              <article
                key={app.name}
                className="flex min-h-70 flex-col justify-between rounded-lg border border-white/12 bg-slate-950/58 p-5 shadow-[0_22px_70px_rgba(2,6,23,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-950/70"
              >
                <div>
                  <div
                    className={`h-1.5 w-20 rounded-full bg-linear-to-r ${app.accent}`}
                  />
                  <div className="mt-5 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {app.name}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {app.description}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                      {app.status}
                    </span>
                  </div>
                </div>

                <div className="mt-8">
                  {app.active ? (
                    <Link
                      href={app.href}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-cyan-200/30 bg-cyan-300/12 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/45 hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      {app.action}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-slate-500"
                    >
                      {app.action ?? "Planned"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <HomeJiraTickets />
      </div>
    </main>
  );
}
