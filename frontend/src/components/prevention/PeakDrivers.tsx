import type { PeakDriver } from "@/types/prevention";

const INCREASE_COLOR = "#dc2626";
const DECREASE_COLOR = "#16a34a";

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
    <div className="rounded-xl border border-ps-border bg-ps-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ps-text-primary">Key drivers</h2>

      <div className="flex flex-col gap-3">
        {drivers.map((driver) => {
          const barColor = driver.direction === "decrease" ? DECREASE_COLOR : INCREASE_COLOR;
          return (
            <div key={driver.name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-ps-text-secondary">{driver.name}</span>
                <span className="font-medium text-ps-text-muted">{driver.contributionPct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ps-border">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${driver.contributionPct}%`, backgroundColor: barColor }}
                />
              </div>
              {hasShap && driver.shapValueMw !== null && (
                <div className="mt-0.5 text-[11px] text-ps-text-muted">
                  {driver.shapValueMw > 0 ? "+" : ""}{driver.shapValueMw.toFixed(1)} MW bulk
                  {" · "}
                  {driver.direction === "increase" ? "pushes demand up" : "reduces demand"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ps-text-muted">
        {hasShap
          ? "Normalized contribution share, not a load percentage. Values are in bulk Mumbai MW (model-native unit), proportionally scaled for display."
          : "Contribution split unavailable — showing fallback estimates."}
      </p>
    </div>
  );
}
