import Link from "next/link";

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
    name: "Ticket to Code",
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
];

export default function Home() {
  const readyCount = workflowApps.filter(
    (app) => app.status === "Ready",
  ).length;
  const plannedCount = workflowApps.filter(
    (app) => app.status === "Planned",
  ).length;

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-slate-950 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                Workflow Apps
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                Internal Workflow Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                A launch point for focused tools that handle repeatable review,
                delivery, and implementation follow-up work.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center sm:min-w-90">
              <div>
                <p className="text-2xl font-semibold text-slate-950">
                  {readyCount}
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Ready
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-950">
                  {plannedCount}
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Planned
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-950">
                  {workflowApps.length}
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
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
                className="text-xl font-semibold text-slate-950"
              >
                Available Workflows
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Pick the workflow that matches the next review or delivery task.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {workflowApps.map((app) => (
              <article
                key={app.name}
                className="flex min-h-70 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div
                    className={`h-1.5 w-20 rounded-full bg-linear-to-r ${app.accent}`}
                  />
                  <div className="mt-5 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        {app.name}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {app.description}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                      {app.status}
                    </span>
                  </div>
                </div>

                <div className="mt-8">
                  {app.active ? (
                    <Link
                      href={app.href}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                    >
                      {app.action}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
                    >
                      {app.action ?? "Planned"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
