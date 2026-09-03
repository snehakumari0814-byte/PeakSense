import { ShieldAlert } from "lucide-react";
import type { PreventionData } from "@/types/prevention";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-ps-text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ps-text-primary">{value}</p>
    </div>
  );
}

export default function PeakRiskOverview({ data }: { data: PreventionData; isLive?: boolean }) {
  const color = RISK_COLORS[data.risk];
  const exceeds = data.exceedanceMw >= 0;

  return (
    <div
      className="rounded-xl border p-5 shadow-sm"
      style={{ borderColor: `${color}33`, backgroundColor: `${color}0d` }}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-ps-text-muted">
        <ShieldAlert className="h-3.5 w-3.5" />
        Peak risk
      </span>

      <p className="mt-1 text-3xl font-bold" style={{ color }}>
        {RISK_LABELS[data.risk]}
      </p>
      <p className="text-xs text-ps-text-secondary">{data.peakProbabilityPct}% probability</p>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ps-border">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, data.peakProbabilityPct)}%`, backgroundColor: color }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Expected demand" value={`${data.expectedDemandMw} MW`} />
        <Stat label="Threshold" value={`${data.thresholdMw} MW`} />
        <Stat
          label="Expected exceedance"
          value={`${exceeds ? "+" : ""}${data.exceedanceMw} MW`}
        />
        <Stat label="Peak window" value={`${data.peakWindow.start} – ${data.peakWindow.end}`} />
      </div>
    </div>
  );
}
