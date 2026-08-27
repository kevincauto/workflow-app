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
    section: "border-cyan-300/45 bg-[rgba(20,92,125,0.72)]",
    bar: "bg-cyan-300",
    eyebrow: "text-cyan-200",
    title: "text-white",
  },
  amber: {
    section: "border-amber-300/45 bg-[rgba(103,55,20,0.72)]",
    bar: "bg-amber-300",
    eyebrow: "text-amber-200",
    title: "text-white",
  },
  emerald: {
    section: "border-emerald-300/45 bg-[rgba(11,96,74,0.72)]",
    bar: "bg-emerald-300",
    eyebrow: "text-emerald-200",
    title: "text-white",
  },
  orange: {
    section: "border-orange-300/50 bg-[rgba(143,64,34,0.72)]",
    bar: "bg-orange-300",
    eyebrow: "text-orange-200",
    title: "text-white",
  },
  purple: {
    section: "border-purple-300/50 bg-[rgba(91,52,121,0.72)]",
    bar: "bg-purple-300",
    eyebrow: "text-purple-200",
    title: "text-white",
  },
  red: {
    section: "border-red-300/50 bg-[rgba(126,36,47,0.72)]",
    bar: "bg-red-300",
    eyebrow: "text-red-200",
    title: "text-white",
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
      className={`relative rounded-[28px] border p-6 shadow-[0_32px_100px_rgba(2,6,23,0.5)] backdrop-blur-xl ${allowOverflow ? "overflow-visible" : "overflow-hidden"} ${accentStyle?.section ?? "border-white/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.15))]"} ${className ?? ""}`}
    >
      {accentStyle ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-7 overflow-hidden rounded-t-[27px]"
          aria-hidden="true"
        >
          <div className={`h-1 ${accentStyle.bar}`} />
        </div>
      ) : null}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p
              className={`text-xs font-semibold uppercase tracking-[0.24em] ${accentStyle?.eyebrow ?? "text-cyan-200/80"}`}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2
            className={`mt-2 text-xl font-semibold ${accentStyle?.title ?? "text-orange-300"}`}
          >
            {title}
          </h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
