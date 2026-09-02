import { Zap, TrendingUp, Clock, ShieldCheck, ArrowDown, ArrowUp } from "lucide-react";
import type { ForecastSummary } from "@/types/forecast";
import DemoDataBadge from "@/components/DemoDataBadge";

function Card({
  icon: Icon,
  label,
  value,
  unit,
  children,
  isLive,
  isDemo,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
  children?: React.ReactNode;
  isLive?: boolean;
  isDemo?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        {isDemo ? (
          <DemoDataBadge label="Demo" />
        ) : isLive ? (
          <DemoDataBadge variant="live" label="Live" />
        ) : (
          <DemoDataBadge variant="fallback" label="Fallback" />
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span>}
      </p>
      <div className="mt-1 text-xs text-slate-500">{children}</div>
    </div>
  );
}

export default function ForecastSummaryCards({
  summary,
  isLive,
}: {
  summary: ForecastSummary;
  isLive: boolean;
}) {
  const changeUp = summary.currentLoadChangePct >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card icon={Zap} label="Current Load" value={summary.currentLoadMw.toString()} unit="MW" isLive={isLive}>
        {isLive ? (
          <span className="text-emerald-500/70">From backend locality API</span>
        ) : (
          <span className={`inline-flex items-center gap-1 ${changeUp ? "text-orange-400" : "text-emerald-400"}`}>
            {changeUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(summary.currentLoadChangePct)}% vs previous period
          </span>
        )}
      </Card>

      <Card
        icon={TrendingUp}
        label="Predicted Peak"
        value={summary.predictedPeakMw.toString()}
        unit="MW"
        isLive={isLive}
      >
        Expected window {summary.predictedPeakWindow.start} – {summary.predictedPeakWindow.end}
      </Card>

      <Card icon={Clock} label="Peak Time" value={summary.peakTime} isLive={isLive}>
        Today
      </Card>

      <Card
        icon={ShieldCheck}
        label="Peak Probability"
        value={summary.peakProbabilityPct.toString()}
        unit="%"
        isLive={isLive}
      >
        Probability of exceeding threshold
      </Card>
    </div>
  );
}
