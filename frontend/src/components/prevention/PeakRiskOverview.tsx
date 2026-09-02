import { ShieldAlert } from "lucide-react";
import type { PreventionData } from "@/types/prevention";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import DemoDataBadge from "@/components/DemoDataBadge";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export default function PeakRiskOverview({
  data,
  isLive,
}: {
  data: PreventionData;
  isLive: boolean;
}) {
  const color = RISK_COLORS[data.risk];
  const exceeds = data.exceedanceMw >= 0;

  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: `${color}4d`, backgroundColor: `${color}0f` }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <ShieldAlert className="h-3.5 w-3.5" />
          Peak Risk
        </span>
        {isLive ? (
          <DemoDataBadge variant="live" label="Model · Live" />
        ) : (
          <DemoDataBadge variant="fallback" label="Demo Fallback" />
        )}
      </div>

      <p className="mt-1 text-3xl font-bold" style={{ color }}>
        {RISK_LABELS[data.risk].toUpperCase()}
      </p>
      <p className="text-xs text-slate-400">{data.peakProbabilityPct}% probability</p>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
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
