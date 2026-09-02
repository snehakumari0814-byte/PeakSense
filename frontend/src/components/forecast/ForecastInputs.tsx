"use client";

import { Info } from "lucide-react";
import type { ForecastInputs as ForecastInputsData, ForecastInputSource } from "@/types/forecast";
import DemoDataBadge from "@/components/DemoDataBadge";

// Source badge config
const SOURCE_CONFIG: Record<
  ForecastInputSource,
  { label: string; className: string }
> = {
  historical_lag: {
    label: "Historical",
    className: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  model_computed: {
    label: "Model-computed",
    className: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  },
  fixed_assumption: {
    label: "Fixed assumption",
    className: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  calendar: {
    label: "Calendar",
    className: "text-slate-400 border-slate-600 bg-slate-800/60",
  },
};

function FeatureRow({
  label,
  value,
  unit,
  source,
  sourceNote,
}: {
  label: string;
  value: number;
  unit: string;
  source: ForecastInputSource;
  sourceNote: string;
}) {
  const cfg = SOURCE_CONFIG[source];
  const displayValue =
    unit
      ? `${Number.isInteger(value) ? value : value.toFixed(source === "calendar" ? 0 : 1)}${unit}`
      : String(Math.round(value));

  return (
    <div className="group flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">{label}</span>
        {/* Tooltip trigger */}
        <span
          className="hidden cursor-help text-slate-600 group-hover:text-slate-400"
          title={sourceNote}
        >
          <Info className="h-3 w-3" />
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">{displayValue}</span>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cfg.className}`}
        >
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

export default function ForecastInputs({
  inputs,
  isDemoFallback = false,
}: {
  inputs: ForecastInputsData;
  isDemoFallback?: boolean;
}) {
  const isLive = !isDemoFallback && inputs.features.length > 0;

  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Model Inputs</h2>
        {isLive ? (
          <DemoDataBadge variant="live" label="Model · Live" />
        ) : (
          <DemoDataBadge variant="fallback" label="Not available" />
        )}
      </div>

      {isLive ? (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {inputs.features.map((feat) => (
              <FeatureRow
                key={feat.feature}
                label={feat.label}
                value={feat.value}
                unit={feat.unit}
                source={feat.source}
                sourceNote={feat.source_note}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            {inputs.disclaimer}
          </p>
          <p className="text-[11px] text-slate-700">
            Hover each row for provenance detail.
          </p>
        </>
      ) : (
        <p className="text-[11px] leading-relaxed text-slate-600">
          Model input features are not available — backend offline or model not loaded.
        </p>
      )}
    </div>
  );
}
