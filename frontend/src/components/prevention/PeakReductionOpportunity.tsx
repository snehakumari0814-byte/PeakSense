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
    <div className="rounded-md border border-ps-border bg-ps-background px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-ps-text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className="mt-1 text-lg font-semibold" style={accent ? { color: accent } : { color: "var(--ps-text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

export default function PeakReductionOpportunity({
  reduction,
}: {
  reduction: PeakReduction;
}) {
  const hasResult = reduction.potentialReductionMw > 0;

  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-ps-text-primary">Peak reduction opportunity</h2>
      {reduction.scenarioDescription && (
        <p className="mt-0.5 mb-3 text-xs text-ps-text-muted">{reduction.scenarioDescription}</p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={Gauge} label="Baseline predicted peak" value={`${reduction.baselinePeakMw} MW`} />
        <Stat
          icon={TrendingDown}
          label="Potential reduction"
          value={hasResult ? `-${reduction.potentialReductionMw} MW` : "—"}
          accent="#16a34a"
        />
        <Stat
          icon={Sparkles}
          label="Potential peak after interventions"
          value={hasResult ? `${reduction.potentialPeakMw} MW` : "—"}
          accent="#2563eb"
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ps-text-muted">
        {hasResult
          ? "Model-derived demand-response scenario estimate; not physical grid actuation."
          : "Scenario data unavailable — backend offline or simulation failed."}
      </p>
    </div>
  );
}
