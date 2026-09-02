import { Gauge, Clock, ShieldAlert } from "lucide-react";
import type { BaselinePeak as BaselinePeakData } from "@/types/simulator";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import DemoDataBadge from "@/components/DemoDataBadge";

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className="mt-0.5 text-lg font-semibold" style={color ? { color } : { color: "#fff" }}>
        {value}
      </p>
    </div>
  );
}

export default function BaselinePeak({
  baseline,
  isLive,
}: {
  baseline: BaselinePeakData;
  isLive: boolean;
}) {
  const riskColor = RISK_COLORS[baseline.risk];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
          Predicted Baseline
        </h2>
        {isLive ? (
          <DemoDataBadge variant="live" label="Model · Live" />
        ) : (
          <DemoDataBadge variant="fallback" label="Demo Fallback" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={Gauge} label="Predicted peak" value={`${baseline.peakMw} MW`} />
        <Stat icon={Clock} label="Peak time" value={baseline.peakTime} />
        <Stat icon={Gauge} label="Threshold" value={`${baseline.thresholdMw} MW`} />
        <Stat
          icon={ShieldAlert}
          label="Risk"
          value={RISK_LABELS[baseline.risk]}
          color={riskColor}
        />
      </div>
    </div>
  );
}
