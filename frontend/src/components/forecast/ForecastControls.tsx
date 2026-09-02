"use client";

import { Calendar, ChevronDown } from "lucide-react";
import type { Locality } from "@/types/locality";
import { FORECAST_HORIZONS, HORIZON_LABELS, type ForecastHorizon } from "@/types/forecast";

export default function ForecastControls({
  localities,
  selectedLocalityId,
  onSelectLocality,
  horizon,
  onSelectHorizon,
}: {
  localities: Locality[];
  selectedLocalityId: string;
  onSelectLocality: (id: string) => void;
  horizon: ForecastHorizon;
  onSelectHorizon: (horizon: ForecastHorizon) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Locality
        </span>
        <div className="relative">
          <select
            value={selectedLocalityId}
            onChange={(e) => onSelectLocality(e.target.value)}
            className="appearance-none rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-3 pr-8 text-sm font-medium text-white focus:border-emerald-500/60 focus:outline-none"
          >
            {localities.map((locality) => (
              <option key={locality.id} value={locality.id}>
                {locality.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      <div className="h-6 w-px bg-slate-800" />

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Horizon
        </span>
        <div className="flex rounded-md border border-slate-700 bg-slate-900 p-0.5">
          {FORECAST_HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onSelectHorizon(h)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                horizon === h
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {HORIZON_LABELS[h]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-6 w-px bg-slate-800" />

      <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300">
        <Calendar className="h-3.5 w-3.5 text-slate-500" />
        Today
      </div>
    </div>
  );
}
