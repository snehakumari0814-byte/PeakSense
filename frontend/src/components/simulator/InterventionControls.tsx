"use client";

import { Loader2, Play, RotateCcw } from "lucide-react";
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
    <div className="rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ps-text-primary">Scenario inputs</h2>
      </div>

      <div className="flex flex-col gap-4">
        {SLIDERS.map((slider) => {
          const pct = Math.round(settings[slider.key] * 100);
          return (
            <div key={slider.key}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-ps-text-secondary">{slider.label}</span>
                <span className="font-medium text-ps-accent">{pct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={slider.maxPct}
                step={1}
                value={pct}
                onChange={(e) => onChange(slider.key, Number(e.target.value))}
                className="ps-slider w-full"
              />
              <div className="flex justify-between text-[10px] text-ps-text-muted">
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
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-ps-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ps-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="flex items-center gap-1.5 rounded-md border border-ps-border bg-ps-card px-3 py-2 text-sm font-medium text-ps-text-secondary transition-colors hover:text-ps-text-primary"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset scenario
        </button>
      </div>

      {isDirty && !isCalculating && (
        <p className="mt-2 text-xs text-ps-warning">
          Sliders changed — run the simulation to update results.
        </p>
      )}

      <style jsx>{`
        .ps-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 9999px;
          background: var(--ps-border);
          outline: none;
        }
        .ps-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: var(--ps-accent);
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px var(--ps-border);
        }
        .ps-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: var(--ps-accent);
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px var(--ps-border);
        }
      `}</style>
    </div>
  );
}
