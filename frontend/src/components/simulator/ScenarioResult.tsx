import { CheckCircle2, TrendingDown } from "lucide-react";
import type { SimulationResult } from "@/types/simulator";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import DemoDataBadge from "@/components/DemoDataBadge";

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
    <div className="flex-1 rounded-md border border-slate-800 bg-slate-900/40 p-4 text-center">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{peakMw} MW</p>
      <p className="mt-1 text-sm font-semibold" style={{ color }}>
        {RISK_LABELS[risk].toUpperCase()}
      </p>
    </div>
  );
}

export default function ScenarioResult({ result }: { result: SimulationResult }) {
  const { baseline, scenario, reductionMw, reductionPct } = result;
  const isLive = !result.isDemoData;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Before / After</h2>
        {isLive ? (
          <DemoDataBadge variant="live" label="Model · Live" />
        ) : (
          <DemoDataBadge variant="fallback" label="Demo Fallback" />
        )}
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <PeakCard label="Baseline" peakMw={baseline.peakMw} risk={baseline.risk} />
        <div className="flex items-center justify-center text-slate-600 sm:px-2">
          <TrendingDown className="h-6 w-6" />
        </div>
        <PeakCard label="Simulated" peakMw={scenario.peakMw} risk={scenario.risk} />
      </div>

      <div className="mt-4 flex flex-col items-center justify-center gap-1 rounded-md border border-slate-800 bg-slate-900/40 p-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Peak reduction
        </p>
        <p className="text-xl font-semibold text-emerald-400">
          {reductionMw} MW
          <span className="ml-2 text-sm font-normal text-slate-400">({reductionPct}%)</span>
        </p>
      </div>

      {scenario.peakAvoided && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-bold tracking-wide">PEAK AVOIDED</span>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-slate-600">
        {isLive
          ? "Demand-response scenario estimate — not a validated physical grid simulation."
          : "Prototype scenario estimate — not a validated grid response."}
      </p>
    </div>
  );
}
