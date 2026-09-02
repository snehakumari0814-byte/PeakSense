import type { InterventionBreakdownItem } from "@/types/simulator";
import DemoDataBadge from "@/components/DemoDataBadge";

export default function InterventionSummary({
  breakdown,
  totalReductionMw,
}: {
  breakdown: InterventionBreakdownItem[];
  totalReductionMw: number;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
          Intervention Summary
        </h2>
        <DemoDataBadge label="Demo" />
      </div>

      <div className="flex flex-col gap-1.5">
        {breakdown.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs"
          >
            <span className="text-slate-300">{item.label}</span>
            <span className="font-medium text-slate-200">
              {item.reductionMw > 0 ? "-" : ""}
              {item.reductionMw} MW
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Total estimated reduction
        </span>
        <span className="text-sm font-semibold text-emerald-400">
          {totalReductionMw > 0 ? "-" : ""}
          {totalReductionMw} MW
        </span>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        All values are prototype estimates, not measured or validated load reductions.
      </p>
    </div>
  );
}
