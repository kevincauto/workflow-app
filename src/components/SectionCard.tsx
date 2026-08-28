import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: "cyan" | "amber" | "emerald" | "orange" | "purple" | "red";
  allowOverflow?: boolean;
}

const accentStyles = {
  cyan: {
    bar: "from-cyan-400 to-blue-500",
    eyebrow: "text-cyan-200",
  },
  amber: {
    bar: "from-amber-300 to-orange-500",
    eyebrow: "text-amber-200",
  },
  emerald: {
    bar: "from-emerald-400 to-teal-500",
    eyebrow: "text-emerald-200",
  },
  orange: {
    bar: "from-orange-400 to-rose-500",
    eyebrow: "text-orange-200",
  },
  purple: {
    bar: "from-violet-400 to-fuchsia-500",
    eyebrow: "text-purple-200",
  },
  red: {
    bar: "from-rose-400 to-red-500",
    eyebrow: "text-red-200",
  },
};

export function SectionCard({
  title,
  eyebrow,
  actions,
  children,
  className,
  accent,
  allowOverflow = false,
}: SectionCardProps) {
  const accentStyle = accent ? accentStyles[accent] : null;

  return (
    <section
      className={`relative rounded-lg border border-white/12 bg-slate-950/58 p-5 shadow-[0_22px_70px_rgba(2,6,23,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-6 ${allowOverflow ? "overflow-visible" : "overflow-hidden"} ${className ?? ""}`}
    >
      {accentStyle ? (
        <div
          className="pointer-events-none absolute left-5 top-0 h-1.5 w-24 overflow-hidden rounded-b-full sm:left-6"
          aria-hidden="true"
        >
          <div className={`h-full bg-linear-to-r ${accentStyle.bar}`} />
        </div>
      ) : null}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow ? (
            <p
              className={`text-xs font-semibold uppercase tracking-[0.24em] ${accentStyle?.eyebrow ?? "text-cyan-200/80"}`}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
