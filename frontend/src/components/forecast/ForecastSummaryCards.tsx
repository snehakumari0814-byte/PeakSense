import { Zap, TrendingUp, Clock, ShieldCheck, ArrowDown, ArrowUp } from "lucide-react";
import type { ForecastSummary } from "@/types/forecast";

function Card({
  icon: Icon,
  label,
  value,
  unit,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <span className="flex items-center gap-1.5 text-xs font-medium text-ps-text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className="mt-2 text-2xl font-semibold text-ps-text-primary">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ps-text-secondary">{unit}</span>}
      </p>
      <div className="mt-1 text-xs text-ps-text-secondary">{children}</div>
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
      <Card icon={Zap} label="Current load" value={summary.currentLoadMw.toString()} unit="MW">
        {isLive ? (
          "From backend locality data"
        ) : (
          <span className={`inline-flex items-center gap-1 ${changeUp ? "text-ps-warning" : "text-ps-success"}`}>
            {changeUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(summary.currentLoadChangePct)}% vs previous period
          </span>
        )}
      </Card>

      <Card icon={TrendingUp} label="Predicted peak" value={summary.predictedPeakMw.toString()} unit="MW">
        Expected window {summary.predictedPeakWindow.start} – {summary.predictedPeakWindow.end}
      </Card>

      <Card icon={Clock} label="Peak time" value={summary.peakTime}>
        Today
      </Card>

      <Card icon={ShieldCheck} label="Peak probability" value={summary.peakProbabilityPct.toString()} unit="%">
        Probability of exceeding threshold
      </Card>
    </div>
  );
}
