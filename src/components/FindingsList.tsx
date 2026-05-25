import { FindingCard } from "@/components/FindingCard";
import type { ReviewFinding } from "@/lib/types";

type Severity = ReviewFinding["severity"];

const severityOrder: Severity[] = ["High", "Medium", "Low"];

interface FindingsListProps {
  findings: ReviewFinding[];
  onToggleApproved: (id: string, approved: boolean) => void;
  onCommentChange: (id: string, text: string) => void;
}

export function FindingsList({
  findings,
  onToggleApproved,
  onCommentChange,
}: FindingsListProps) {
  const grouped = findings.reduce<Record<Severity, ReviewFinding[]>>(
    (accumulator, finding) => {
      accumulator[finding.severity].push(finding);
      return accumulator;
    },
    {
      High: [],
      Medium: [],
      Low: [],
    },
  );

  return (
    <div className="space-y-6">
      {severityOrder.map((severity) => {
        const groupFindings = grouped[severity];

        if (groupFindings.length === 0) {
          return null;
        }

        return (
          <div key={severity} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">
                {severity} Severity
              </h3>
              <p className="text-xs text-slate-300">
                {groupFindings.length} findings
              </p>
            </div>
            <div className="space-y-4">
              {groupFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onToggleApproved={onToggleApproved}
                  onCommentChange={onCommentChange}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
