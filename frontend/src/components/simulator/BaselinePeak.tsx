import { Gauge, Clock, ShieldAlert } from "lucide-react";
import type { BaselinePeak as BaselinePeakData } from "@/types/simulator";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";

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
      <span className="flex items-center gap-1.5 text-xs font-medium text-ps-text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className="mt-0.5 text-lg font-semibold" style={color ? { color } : { color: "var(--ps-text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

export default function BaselinePeak({
  baseline,
}: {
  baseline: BaselinePeakData;
  isLive: boolean;
}) {
  const riskColor = RISK_COLORS[baseline.risk];

  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ps-text-primary">Predicted baseline</h2>
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
