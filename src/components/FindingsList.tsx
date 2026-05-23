import { FindingCard } from "@/components/FindingCard";
import type { ReviewFinding } from "@/lib/types";

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
  const grouped = findings.reduce<Record<string, ReviewFinding[]>>(
    (accumulator, finding) => {
      const key = finding.filePath ?? "General";
      accumulator[key] = accumulator[key] ?? [];
      accumulator[key].push(finding);
      return accumulator;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([group, groupFindings]) => (
        <div key={group} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              {group}
            </h3>
            <p className="text-xs text-slate-500">
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
      ))}
    </div>
  );
}
