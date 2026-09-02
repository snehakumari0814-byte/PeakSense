import { ShieldAlert } from "lucide-react";
import type { PeakAnalysis } from "@/types/forecast";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";

export default function PeakRiskScore({ analysis }: { analysis: PeakAnalysis }) {
  const color = RISK_COLORS[analysis.risk];
  const pct = Math.max(0, Math.min(100, analysis.peakProbabilityPct));

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: `${color}4d`, backgroundColor: `${color}0f` }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <ShieldAlert className="h-3.5 w-3.5" />
          Peak Risk
        </span>
      </div>

      <p className="mt-1 text-2xl font-bold" style={{ color }}>
        {RISK_LABELS[analysis.risk].toUpperCase()}
      </p>
      <p className="text-xs text-slate-400">{pct}% probability</p>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        Threshold exceedance likely around{" "}
        <span className="font-medium text-slate-300">{analysis.peakTime}</span>
      </p>
    </div>
  );
}
