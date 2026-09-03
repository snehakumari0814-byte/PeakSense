"use client";

import { ChevronDown } from "lucide-react";
import type { Locality } from "@/types/locality";
import { FORECAST_HORIZONS, HORIZON_LABELS, type ForecastHorizon } from "@/types/forecast";
import DatePicker from "@/components/DatePicker";
import type { DateAvailability, DateString } from "@/lib/date";

export default function ForecastControls({
  localities,
  selectedLocalityId,
  onSelectLocality,
  horizon,
  onSelectHorizon,
  selectedDate,
  availability,
  onSelectDate,
}: {
  localities: Locality[];
  selectedLocalityId: string;
  onSelectLocality: (id: string) => void;
  horizon: ForecastHorizon;
  onSelectHorizon: (horizon: ForecastHorizon) => void;
  selectedDate: DateString;
  availability: DateAvailability | null;
  onSelectDate: (date: DateString) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ps-border bg-ps-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-ps-text-muted">Locality</span>
        <div className="relative">
          <select
            value={selectedLocalityId}
            onChange={(e) => onSelectLocality(e.target.value)}
            className="appearance-none rounded-md border border-ps-border bg-ps-card py-1.5 pl-3 pr-8 text-sm font-medium text-ps-text-primary focus:border-ps-accent focus:outline-none"
          >
            {localities.map((locality) => (
              <option key={locality.id} value={locality.id}>
                {locality.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ps-text-muted" />
        </div>
      </div>

      <div className="h-6 w-px bg-ps-border" />

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-ps-text-muted">Horizon</span>
        <div className="flex rounded-md border border-ps-border bg-ps-background p-0.5">
          {FORECAST_HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onSelectHorizon(h)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                horizon === h
                  ? "bg-ps-card text-ps-text-primary shadow-sm"
                  : "text-ps-text-secondary hover:text-ps-text-primary"
              }`}
            >
              {HORIZON_LABELS[h]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-6 w-px bg-ps-border" />

      <DatePicker selectedDate={selectedDate} availability={availability} onSelect={onSelectDate} />
    </div>
  );
}
