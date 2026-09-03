import { Snowflake, Building2, ListTree, Sun, TrendingDown } from "lucide-react";
import type { Recommendation } from "@/types/prevention";

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
  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ps-text-primary">Recommended actions</h2>

      {isDemoData && (
        <p className="mb-3 text-xs text-ps-text-muted">
          Backend recommendation engine unavailable — showing local estimates.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {recommendations.map((rec, i) => {
          const Icon = ICONS[rec.id] ?? ListTree;
          const hasSimMw = rec.simulatedReductionMw !== null;

          return (
            <div key={rec.id} className="rounded-lg border border-ps-border bg-ps-background p-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ps-success-soft text-ps-success">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ps-text-muted">{i + 1}.</p>
                  <h3 className="text-sm font-medium text-ps-text-primary">{rec.title}</h3>
                  <p className="mt-0.5 text-xs text-ps-text-secondary">{rec.description}</p>

                  {hasSimMw ? (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-ps-text-primary">
                      <TrendingDown className="h-3 w-3 text-ps-success" />
                      Scenario estimate: −{rec.simulatedReductionMw} MW
                    </p>
                  ) : rec.impact ? (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-ps-text-muted">
                      <TrendingDown className="h-3 w-3 text-ps-text-muted" />
                      Est. range: {rec.impact.minMw}–{rec.impact.maxMw} MW
                    </p>
                  ) : null}

                  {rec.driverBasis && rec.driverBasis !== "demo estimate" && (
                    <p className="mt-1 text-[11px] text-ps-text-muted">
                      Based on: {rec.driverBasis}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ps-text-muted">
        Scenario estimates from the simulation engine (moderate default scenario) — not measured
        utility savings.
      </p>
    </div>
  );
}
