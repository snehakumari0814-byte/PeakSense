import { CheckCircle2, ArrowRight } from "lucide-react";
import type { SimulationResult } from "@/types/simulator";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";

function PeakCard({
  label,
  peakMw,
  risk,
}: {
  label: string;
  peakMw: number;
  risk: keyof typeof RISK_COLORS;
}) {
  const color = RISK_COLORS[risk];
  return (
    <div className="flex-1 rounded-lg border border-ps-border bg-ps-background p-4 text-center">
      <p className="text-xs font-medium text-ps-text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-ps-text-primary">{peakMw} MW</p>
      <p className="mt-1 text-sm font-semibold" style={{ color }}>
        {RISK_LABELS[risk]}
      </p>
    </div>
  );
}

export default function ScenarioResult({ result }: { result: SimulationResult }) {
  const { baseline, scenario, reductionMw, reductionPct } = result;

  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-ps-text-primary">Before / after</h2>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <PeakCard label="Baseline" peakMw={baseline.peakMw} risk={baseline.risk} />
        <div className="flex items-center justify-center text-ps-text-muted sm:px-2">
          <ArrowRight className="h-5 w-5" />
        </div>
        <PeakCard label="Simulated" peakMw={scenario.peakMw} risk={scenario.risk} />
      </div>

      <div className="mt-4 flex flex-col items-center justify-center gap-1 rounded-lg border border-ps-border bg-ps-background p-3 text-center">
        <p className="text-xs font-medium text-ps-text-muted">
          Peak reduction
        </p>
        <p className="text-xl font-semibold text-ps-success">
          {reductionMw} MW
          <span className="ml-2 text-sm font-normal text-ps-text-secondary">({reductionPct}%)</span>
        </p>
      </div>

      {scenario.peakAvoided && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-ps-success bg-ps-success-soft px-4 py-3 text-ps-success">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-semibold">Peak avoided</span>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-ps-text-muted">
        Demand-response scenario estimate — not a validated physical grid simulation.
      </p>
    </div>
  );
}
