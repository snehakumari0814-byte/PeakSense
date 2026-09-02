import type { PeakDriver } from "@/types/prevention";
import DemoDataBadge from "@/components/DemoDataBadge";

const BAR_COLOR = "#22d3ee";

export default function PeakDrivers({ drivers }: { drivers: PeakDriver[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Key Drivers</h2>
        <DemoDataBadge label="Demo" />
      </div>

      <div className="flex flex-col gap-3">
        {drivers.map((driver) => (
          <div key={driver.name}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-300">{driver.name}</span>
              <span className="font-medium text-slate-400">{driver.contributionPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full"
                style={{ width: `${driver.contributionPct}%`, backgroundColor: BAR_COLOR }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        Demo contribution split only — not real model feature importance.
      </p>
    </div>
  );
}
