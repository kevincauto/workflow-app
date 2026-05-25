import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  eyebrow,
  actions,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      className={`rounded-[28px] border border-white/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.15))] p-6 shadow-[0_32px_100px_rgba(2,6,23,0.5)] backdrop-blur-xl ${className ?? ""}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-s font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-xl font-semibold text-slate-50">{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
