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
      className={`rounded-[28px] border border-white/12 bg-white/8 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.25)] backdrop-blur ${className ?? ""}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-s font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
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
