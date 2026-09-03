import type { InterventionBreakdownItem } from "@/types/simulator";

export default function InterventionSummary({
  breakdown,
  totalReductionMw,
}: {
  breakdown: InterventionBreakdownItem[];
  totalReductionMw: number;
  isDemoData: boolean;
}) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ps-text-primary">Intervention summary</h2>

      <div className="flex flex-col gap-1.5">
        {breakdown.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-md border border-ps-border bg-ps-background px-3 py-2 text-xs"
          >
            <span className="text-ps-text-secondary">{item.label}</span>
            <span className="font-medium text-ps-text-primary">
              {item.reductionMw > 0 ? "-" : ""}
              {item.reductionMw} MW
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-ps-border pt-3">
        <span className="text-xs font-medium text-ps-text-muted">
          Total estimated reduction
        </span>
        <span className="text-sm font-semibold text-ps-success">
          {totalReductionMw > 0 ? "-" : ""}
          {totalReductionMw} MW
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ps-text-muted">
        Reduction values are calculated scenario estimates using documented demand-response
        coefficients — not measured or validated load reductions.
      </p>
    </div>
  );
}
