import { Gauge, TrendingDown, Sparkles } from "lucide-react";
import type { PeakReduction } from "@/types/prevention";

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className="mt-1 text-lg font-semibold" style={accent ? { color: accent } : { color: "#fff" }}>
        {value}
      </p>
    </div>
  );
}

export default function PeakReductionOpportunity({ reduction }: { reduction: PeakReduction }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
          Peak Reduction Opportunity
        </h2>
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-400">
          Prototype scenario estimate
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={Gauge} label="Baseline predicted peak" value={`${reduction.baselinePeakMw} MW`} />
        <Stat
          icon={TrendingDown}
          label="Potential reduction"
          value={`-${reduction.potentialReductionMw} MW`}
          accent="#34d399"
        />
        <Stat
          icon={Sparkles}
          label="Potential peak after interventions"
          value={`${reduction.potentialPeakMw} MW`}
          accent="#22d3ee"
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        This scenario has not been validated by the forecasting model — it sums the demo
        recommendation estimates above.
      </p>
    </div>
  );
}
