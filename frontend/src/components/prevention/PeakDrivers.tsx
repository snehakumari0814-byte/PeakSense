import type { PeakDriver } from "@/types/prevention";
import DemoDataBadge from "@/components/DemoDataBadge";

export default function PeakDrivers({
  drivers,
  isDemoData,
}: {
  drivers: PeakDriver[];
  isDemoData: boolean;
}) {
  const isLive = !isDemoData;
  const hasShap = isLive && drivers.some((d) => d.shapValueMw !== null);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Key Drivers</h2>
          {hasShap && (
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-600">
              Model Contributions
            </p>
          )}
        </div>
        {isLive ? (
          <DemoDataBadge variant="live" label="SHAP · Live" />
        ) : (
          <DemoDataBadge variant="fallback" label="Demo Fallback" />
        )}
      </div>

      <div className="flex flex-col gap-3">
        {drivers.map((driver) => {
          const barColor = driver.direction === "decrease" ? "#34d399" : "#22d3ee";
          return (
            <div key={driver.name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-300">{driver.name}</span>
                <span className="font-medium text-slate-400">{driver.contributionPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${driver.contributionPct}%`, backgroundColor: barColor }}
                />
              </div>
              {hasShap && driver.shapValueMw !== null && (
                <div className="mt-0.5 text-[10px] text-slate-600">
                  SHAP: {driver.shapValueMw > 0 ? "+" : ""}{driver.shapValueMw.toFixed(1)} MW bulk
                  {" · "}
                  {driver.direction === "increase" ? "↑ pushes demand up" : "↓ reduces demand"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        {hasShap
          ? "Normalized SHAP contribution share — not a load percentage. Values are in bulk Mumbai MW (model-native unit), proportionally scaled for display."
          : isDemoData
          ? "Demo contribution split only — not real model feature importance."
          : "SHAP values unavailable — showing fallback estimates."}
      </p>
    </div>
  );
}
