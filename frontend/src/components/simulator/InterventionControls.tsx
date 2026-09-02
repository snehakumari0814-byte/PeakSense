"use client";

import { Loader2, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { InterventionSettings } from "@/types/simulator";

type SliderKey = keyof InterventionSettings;

const SLIDERS: { key: SliderKey; label: string; maxPct: number }[] = [
  { key: "coolingShift", label: "Cooling load shifting", maxPct: 50 },
  { key: "commercialShift", label: "Commercial demand shifting", maxPct: 50 },
  { key: "flexibleLoad", label: "Flexible load shifting", maxPct: 50 },
  { key: "solarUtilization", label: "Solar utilization", maxPct: 100 },
];

export default function InterventionControls({
  settings,
  onChange,
  onRun,
  onReset,
  isCalculating,
  isDirty,
}: {
  settings: InterventionSettings;
  onChange: (key: SliderKey, valuePct: number) => void;
  onRun: () => void;
  onReset: () => void;
  isCalculating: boolean;
  isDirty: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
          Intervention Controls
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-400">
          <SlidersHorizontal className="h-3 w-3" />
          Scenario Inputs
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {SLIDERS.map((slider) => {
          const pct = Math.round(settings[slider.key] * 100);
          return (
            <div key={slider.key}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-300">{slider.label}</span>
                <span className="font-medium text-emerald-400">{pct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={slider.maxPct}
                step={1}
                value={pct}
                onChange={(e) => onChange(slider.key, Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>0%</span>
                <span>{slider.maxPct}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={isCalculating}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCalculating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating…
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run simulation
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset scenario
        </button>
      </div>

      {isDirty && !isCalculating && (
        <p className="mt-2 text-[11px] text-amber-400">
          Sliders changed — run the simulation to update results.
        </p>
      )}
    </div>
  );
}
