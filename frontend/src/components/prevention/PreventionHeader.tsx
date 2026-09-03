"use client";

import { ChevronDown, Clock } from "lucide-react";
import type { Locality } from "@/types/locality";
import { RISK_COLORS, RISK_LABELS, type RiskLevel } from "@/lib/risk";
import DatePicker from "@/components/DatePicker";
import type { DateAvailability, DateString } from "@/lib/date";

export default function PreventionHeader({
  localities,
  selectedLocalityId,
  onSelectLocality,
  peakTime,
  risk,
  selectedDate,
  availability,
  onSelectDate,
}: {
  localities: Locality[];
  selectedLocalityId: string;
  onSelectLocality: (id: string) => void;
  peakTime: string;
  risk: RiskLevel;
  selectedDate: DateString;
  availability: DateAvailability | null;
  onSelectDate: (date: DateString) => void;
}) {
  const riskColor = RISK_COLORS[risk];

  return (
    <div>
      <h1 className="text-xl font-semibold text-ps-text-primary">Peak prevention</h1>
      <p className="mt-1 text-sm text-ps-text-secondary">
        Identify actions to reduce predicted grid stress
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-ps-border bg-ps-card px-4 py-3 shadow-sm">
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

        <div className="h-6 w-px bg-ps-border" />

        <div className="flex items-center gap-1.5 rounded-md border border-ps-border bg-ps-background px-3 py-1.5 text-xs font-medium text-ps-text-secondary">
          <Clock className="h-3.5 w-3.5 text-ps-text-muted" />
          Predicted peak {peakTime}
        </div>

        <div
          className="ml-auto rounded-full border px-2.5 py-1 text-xs font-semibold"
          style={{ borderColor: `${riskColor}40`, backgroundColor: `${riskColor}14`, color: riskColor }}
        >
          {RISK_LABELS[risk]}
        </div>
      </div>
    </div>
  );
}
