"use client";

import { ChevronDown } from "lucide-react";
import type { Locality } from "@/types/locality";

export default function SimulatorHeader({
  localities,
  selectedLocalityId,
  onSelectLocality,
}: {
  localities: Locality[];
  selectedLocalityId: string;
  onSelectLocality: (id: string) => void;
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-white">What-If Simulator</h1>
      <p className="mt-1 text-sm text-slate-500">
        Test demand-response interventions before the predicted peak.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
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
    </div>
  );
}
