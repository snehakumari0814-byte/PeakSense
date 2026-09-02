"use client";

import { RotateCcw } from "lucide-react";
import { RISK_COLORS, RISK_LABELS, type RiskLevel } from "@/lib/risk";

const LEGEND_ORDER: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export type LayerKey = "flow" | "riskHeat" | "demand" | "solar";

const LAYER_OPTIONS: { key: LayerKey; label: string }[] = [
  { key: "flow", label: "Electricity Flow" },
  { key: "riskHeat", label: "Risk Heat" },
  { key: "demand", label: "Demand Intensity" },
  { key: "solar", label: "Solar Potential" },
];

export default function TwinControls({
  layers,
  onToggleLayer,
  onReset,
}: {
  layers: Record<LayerKey, boolean>;
  onToggleLayer: (key: LayerKey) => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/85 px-3 py-2.5 backdrop-blur-sm">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Peak risk legend
          </span>
          <div className="flex flex-col gap-1">
            {LEGEND_ORDER.map((level) => (
              <div key={level} className="flex items-center gap-2 text-xs text-slate-300">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: RISK_COLORS[level] }}
                />
                {RISK_LABELS[level]}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/85 px-3 py-2.5 backdrop-blur-sm">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Grid view
          </span>
          <div className="flex flex-col gap-1.5">
            {LAYER_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className="flex cursor-pointer select-none items-center gap-2 text-xs text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={layers[opt.key]}
                  onChange={() => onToggleLayer(opt.key)}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 accent-emerald-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-auto absolute right-4 top-4">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset view
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] leading-relaxed text-slate-500 backdrop-blur-sm">
        Drag to orbit · scroll to zoom · click a zone to focus
      </div>
    </>
  );
}
