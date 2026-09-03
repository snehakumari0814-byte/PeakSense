"use client";

import { ArrowUp, ArrowDown } from "lucide-react";
import type { FeatureDriver } from "@/types/forecast";

const CATEGORY_COLORS: Record<string, string> = {
  lag: "#2563eb",
  rolling: "#7c3aed",
  temporal: "#0891b2",
  weather: "#d97706",
  solar: "#ca8a04",
  other: "#64748b",
};

const INCREASE_COLOR = "#dc2626"; // pushes demand up
const DECREASE_COLOR = "#16a34a"; // reduces demand

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
      <p className="mb-3 text-xs font-medium text-ps-text-muted">
        Feature contributions
        <span className="ml-1 font-normal text-ps-text-muted">
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
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: catColor }}
                  title={d.category}
                />
                <span className="truncate text-xs text-ps-text-secondary" title={d.label}>
                  {d.label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {d.direction === "increase" ? (
                  <ArrowUp className="h-3 w-3" style={{ color: INCREASE_COLOR }} />
                ) : (
                  <ArrowDown className="h-3 w-3" style={{ color: DECREASE_COLOR }} />
                )}
                <span
                  className="text-xs font-medium tabular-nums"
                  style={{ color: barColor }}
                >
                  {sign}{d.shapValueMw.toFixed(1)} MW
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ps-border">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barPct}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-4 pt-1">
        <span className="flex items-center gap-1 text-[11px] text-ps-text-muted">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: INCREASE_COLOR }} />
          Pushes demand higher
        </span>
        <span className="flex items-center gap-1 text-[11px] text-ps-text-muted">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: DECREASE_COLOR }} />
          Pushes demand lower
        </span>
      </div>
    </div>
  );
}
