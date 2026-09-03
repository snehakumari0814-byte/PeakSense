import { Gauge, ArrowUpRight, Clock, ShieldAlert, Percent } from "lucide-react";
import type { PeakAnalysis as PeakAnalysisData } from "@/types/forecast";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";

function Row({
  icon: Icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="flex items-center gap-2 text-xs text-ps-text-secondary">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span
        className="text-sm font-medium"
        style={valueColor ? { color: valueColor } : { color: "var(--ps-text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function PeakAnalysis({ analysis }: { analysis: PeakAnalysisData; isLive?: boolean }) {
  const riskColor = RISK_COLORS[analysis.risk];
  const exceeds = analysis.exceedanceMw >= 0;

  return (
    <div className="flex h-full flex-col gap-1 rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-ps-text-primary">Peak analysis</h2>

      <Row icon={Gauge} label="Predicted peak" value={`${analysis.predictedPeakMw} MW`} />
      <Row icon={Gauge} label="Threshold" value={`${analysis.thresholdMw} MW`} />
      <Row
        icon={ArrowUpRight}
        label="Exceedance"
        value={`${exceeds ? "+" : ""}${analysis.exceedanceMw} MW`}
        valueColor={exceeds ? "#dc2626" : "#16a34a"}
      />
      <Row icon={Clock} label="Peak time" value={analysis.peakTime} />
      <Row icon={ShieldAlert} label="Risk" value={RISK_LABELS[analysis.risk]} valueColor={riskColor} />
      <Row icon={Percent} label="Peak probability" value={`${analysis.peakProbabilityPct}%`} />
    </div>
  );
}
