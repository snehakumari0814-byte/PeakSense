"use client";

import { ArrowUp, ArrowDown } from "lucide-react";
import type { FeatureDriver } from "@/types/forecast";

const CATEGORY_COLORS: Record<string, string> = {
  lag: "#60a5fa",      // blue
  rolling: "#818cf8",  // indigo
  temporal: "#a78bfa", // violet
  weather: "#fb923c",  // orange
  solar: "#facc15",    // yellow
  other: "#94a3b8",    // slate
};

const INCREASE_COLOR = "#f87171"; // red — pushes demand up
const DECREASE_COLOR = "#34d399"; // green — pushes demand down

/**
 * Horizontal bar chart of SHAP feature contributions.
 *
 * Bar width = |shapValueMw| / maxAbs (scaled to %).
 * Color = direction (red=increase, green=decrease).
 *
 * IMPORTANT: values are in bulk Mumbai MW (model's native scale).
 * The component labels this clearly so users aren't misled.
 */
export default function ExplanationDrivers({
  drivers,
  baseValueMw,
}: {
  drivers: FeatureDriver[];
  baseValueMw: number;
}) {
  if (drivers.length === 0) return null;

  const maxAbs = Math.max(...drivers.map((d) => Math.abs(d.shapValueMw)));

  return (
    <div className="mt-3 space-y-2 pl-11">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        SHAP Feature Contributions
        <span className="ml-1 font-normal normal-case text-slate-600">
          — bulk Mumbai MW (model baseline: {baseValueMw.toFixed(0)} MW)
        </span>
      </p>

      {drivers.map((d) => {
        const barPct = maxAbs > 0 ? (Math.abs(d.shapValueMw) / maxAbs) * 100 : 0;
        const barColor = d.direction === "increase" ? INCREASE_COLOR : DECREASE_COLOR;
        const catColor = CATEGORY_COLORS[d.category] ?? CATEGORY_COLORS.other;
        const sign = d.shapValueMw >= 0 ? "+" : "";

        return (
          <div key={d.feature} className="group">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Category dot */}
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: catColor }}
                  title={d.category}
                />
                <span className="truncate text-[11px] text-slate-300" title={d.label}>
                  {d.label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {d.direction === "increase" ? (
                  <ArrowUp className="h-3 w-3 text-red-400" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-emerald-400" />
                )}
                <span
                  className="text-[11px] font-mono font-medium tabular-nums"
                  style={{ color: barColor }}
                >
                  {sign}{d.shapValueMw.toFixed(1)} MW
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barPct}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <span className="flex items-center gap-1 text-[10px] text-slate-600">
          <span className="h-2 w-2 rounded-sm bg-red-400/70" />
          Pushes demand higher
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-600">
          <span className="h-2 w-2 rounded-sm bg-emerald-400/70" />
          Pushes demand lower
        </span>
      </div>
    </div>
  );
}
