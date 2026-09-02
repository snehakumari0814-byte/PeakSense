"use client";

import { ChevronDown, Clock } from "lucide-react";
import type { Locality } from "@/types/locality";
import { RISK_COLORS, RISK_LABELS, type RiskLevel } from "@/lib/risk";

export default function PreventionHeader({
  localities,
  selectedLocalityId,
  onSelectLocality,
  peakTime,
  risk,
}: {
  localities: Locality[];
  selectedLocalityId: string;
  onSelectLocality: (id: string) => void;
  peakTime: string;
  risk: RiskLevel;
}) {
  const riskColor = RISK_COLORS[risk];

  return (
    <div>
      <h1 className="text-xl font-semibold text-white">Peak Prevention</h1>
      <p className="mt-1 text-sm text-slate-500">
        Understand the predicted peak and identify actions to reduce grid stress.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
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

        <div className="h-6 w-px bg-slate-800" />

        <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300">
          Today
        </div>

        <div className="h-6 w-px bg-slate-800" />

        <div className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          Predicted peak {peakTime}
        </div>

        <div
          className="ml-auto rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{ borderColor: `${riskColor}4d`, backgroundColor: `${riskColor}1a`, color: riskColor }}
        >
          {RISK_LABELS[risk].toUpperCase()}
        </div>
      </div>
    </div>
  );
}
