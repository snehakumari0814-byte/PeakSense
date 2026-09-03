"use client";

import { ChevronDown } from "lucide-react";
import type { Locality } from "@/types/locality";
import DatePicker from "@/components/DatePicker";
import type { DateAvailability, DateString } from "@/lib/date";

export default function SimulatorHeader({
  localities,
  selectedLocalityId,
  onSelectLocality,
  selectedDate,
  availability,
  onSelectDate,
}: {
  localities: Locality[];
  selectedLocalityId: string;
  onSelectLocality: (id: string) => void;
  selectedDate: DateString;
  availability: DateAvailability | null;
  onSelectDate: (date: DateString) => void;
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-ps-text-primary">What-if simulator</h1>
      <p className="mt-1 text-sm text-ps-text-secondary">
        Test demand-response interventions before the predicted peak
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-ps-border bg-ps-card px-4 py-3 shadow-sm">
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

        <div className="h-6 w-px bg-ps-border" />

        <DatePicker selectedDate={selectedDate} availability={availability} onSelect={onSelectDate} />
      </div>
    </div>
  );
}
