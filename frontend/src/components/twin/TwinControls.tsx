"use client";

import { Activity, AlertTriangle, RotateCcw } from "lucide-react";
import { RISK_COLORS, RISK_LABELS, type RiskLevel } from "@/lib/risk";

const LEGEND_ORDER: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export type LayerKey = "flow" | "riskHeat" | "demand" | "solar";

const LAYER_OPTIONS: { key: LayerKey; label: string; subtext: string }[] = [
  { key: "flow", label: "Electricity Flow", subtext: "Stylized demand-flow visualization" },
  { key: "riskHeat", label: "Risk Heat", subtext: "Live ML forecast risk" },
  { key: "demand", label: "Demand Intensity", subtext: "Live baseline demand MW" },
  { key: "solar", label: "Solar Potential", subtext: "Prototype context layer" },
];

export default function TwinControls({
  layers,
  backendStatus = "live",
  onToggleLayer,
  onReset,
}: {
  layers: Record<LayerKey, boolean>;
  backendStatus?: "live" | "fallback" | "checking";
  onToggleLayer: (key: LayerKey) => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-2.5">
        {/* Live Status Badge */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur-sm">
          {backendStatus === "live" && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>LIVE MODEL</span>
            </div>
          )}
          {backendStatus === "fallback" && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              <span>DEMO FALLBACK</span>
            </div>
          )}
          {backendStatus === "checking" && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Activity className="h-3 w-3 animate-pulse" />
              <span>CHECKING API…</span>
            </div>
          )}
        </div>

        {/* Peak Risk Legend */}
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

        {/* Grid View Layer Toggles */}
        <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/85 px-3 py-2.5 backdrop-blur-sm">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Grid view layers
          </span>
          <div className="flex flex-col gap-2">
            {LAYER_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className="flex cursor-pointer select-none items-start gap-2 text-xs text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={layers[opt.key]}
                  onChange={() => onToggleLayer(opt.key)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 accent-emerald-500"
                />
                <div className="flex flex-col">
                  <span>{opt.label}</span>
                  <span className="text-[10px] text-slate-500">{opt.subtext}</span>
                </div>
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
