import { Snowflake, Building2, ListTree, Sun, TrendingDown } from "lucide-react";
import type { Recommendation } from "@/types/prevention";
import DemoDataBadge from "@/components/DemoDataBadge";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "cooling-load-shifting": Snowflake,
  "commercial-demand-response": Building2,
  "flexible-load-scheduling": ListTree,
  "solar-utilization": Sun,
};

export default function MitigationRecommendations({
  recommendations,
  isDemoData,
}: {
  recommendations: Recommendation[];
  isDemoData: boolean;
}) {
  const isLive = !isDemoData;
  // "Live" if at least one recommendation has a real simulation-backed reduction
  const hasSimulation = recommendations.some((r) => r.simulatedReductionMw !== null);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
          Recommended Actions
        </h2>
        {isLive && hasSimulation ? (
          <DemoDataBadge variant="live" label="Model · Live" />
        ) : (
          <DemoDataBadge variant="fallback" label="Demo Fallback" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {recommendations.map((rec, i) => {
          const Icon = ICONS[rec.id] ?? ListTree;
          const hasSimMw = rec.simulatedReductionMw !== null;

          return (
            <div key={rec.id} className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{i + 1}.</p>
                  <h3 className="text-sm font-medium text-white">{rec.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{rec.description}</p>

                  {hasSimMw ? (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-300">
                      <TrendingDown className="h-3 w-3 text-emerald-400" />
                      Scenario estimate: −{rec.simulatedReductionMw} MW
                    </p>
                  ) : rec.impact ? (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-500">
                      <TrendingDown className="h-3 w-3 text-slate-500" />
                      Est. range: {rec.impact.minMw}–{rec.impact.maxMw} MW (demo)
                    </p>
                  ) : null}

                  {rec.driverBasis && rec.driverBasis !== "demo estimate" && (
                    <p className="mt-1 text-[10px] text-slate-600">
                      Based on: {rec.driverBasis}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        {hasSimulation && isLive
          ? "Scenario estimates from POST /api/simulate (moderate default scenario). Not measured utility savings."
          : "Prototype recommendation estimates — not connected to utility systems."}
      </p>
    </div>
  );
}
