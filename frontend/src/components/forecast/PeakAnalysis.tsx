import { Gauge, ArrowUpRight, Clock, ShieldAlert, Percent } from "lucide-react";
import type { PeakAnalysis as PeakAnalysisData } from "@/types/forecast";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import DemoDataBadge from "@/components/DemoDataBadge";

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
      <span className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-sm font-medium" style={valueColor ? { color: valueColor } : { color: "#fff" }}>
        {value}
      </span>
    </div>
  );
}

export default function PeakAnalysis({ analysis }: { analysis: PeakAnalysisData }) {
  const riskColor = RISK_COLORS[analysis.risk];
  const exceeds = analysis.exceedanceMw >= 0;

  return (
    <div className="flex h-full flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Peak Analysis</h2>
        <DemoDataBadge label="Demo" />
      </div>

      <Row icon={Gauge} label="Predicted peak" value={`${analysis.predictedPeakMw} MW`} />
      <Row icon={Gauge} label="Threshold" value={`${analysis.thresholdMw} MW`} />
      <Row
        icon={ArrowUpRight}
        label="Exceedance"
        value={`${exceeds ? "+" : ""}${analysis.exceedanceMw} MW`}
        valueColor={exceeds ? "#f87171" : "#34d399"}
      />
      <Row icon={Clock} label="Peak time" value={analysis.peakTime} />
      <Row icon={ShieldAlert} label="Risk" value={RISK_LABELS[analysis.risk]} valueColor={riskColor} />
      <Row icon={Percent} label="Peak probability" value={`${analysis.peakProbabilityPct}%`} />
    </div>
  );
}
