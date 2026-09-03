import { ShieldAlert } from "lucide-react";
import type { PeakAnalysis } from "@/types/forecast";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";

export default function PeakRiskScore({ analysis }: { analysis: PeakAnalysis; isLive?: boolean }) {
  const color = RISK_COLORS[analysis.risk];
  const pct = Math.max(0, Math.min(100, analysis.peakProbabilityPct));

  return (
    <div
      className="rounded-xl border p-4 shadow-sm"
      style={{ borderColor: `${color}33`, backgroundColor: `${color}0d` }}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-ps-text-muted">
        <ShieldAlert className="h-3.5 w-3.5" />
        Peak risk
      </span>

      <p className="mt-1 text-2xl font-bold" style={{ color }}>
        {RISK_LABELS[analysis.risk]}
      </p>
      <p className="text-xs text-ps-text-secondary">{pct}% probability</p>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ps-border">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      <p className="mt-3 text-xs text-ps-text-secondary">
        Threshold exceedance likely around{" "}
        <span className="font-medium text-ps-text-primary">{analysis.peakTime}</span>
      </p>
    </div>
  );
}
