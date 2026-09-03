"use client";

import type { ForecastInputs as ForecastInputsData } from "@/types/forecast";

function FeatureRow({
  label,
  value,
  unit,
  isAssumption,
}: {
  label: string;
  value: number;
  unit: string;
  isAssumption: boolean;
}) {
  const displayValue = unit
    ? `${Number.isInteger(value) ? value : value.toFixed(1)}${unit}`
    : String(Math.round(value));

  return (
    <div className="flex items-center justify-between rounded-md border border-ps-border bg-ps-background px-3 py-2">
      <span className="text-xs text-ps-text-secondary">
        {label}
        {isAssumption && <span className="ml-1 text-ps-text-muted">*</span>}
      </span>
      <span className="text-sm font-medium text-ps-text-primary">{displayValue}</span>
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
  const hasData = !isDemoFallback && inputs.features.length > 0;
  const hasAssumptions = inputs.features.some((f) => f.source === "fixed_assumption");

  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-ps-text-primary">Model inputs</h2>

      {hasData ? (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {inputs.features.map((feat) => (
              <FeatureRow
                key={feat.feature}
                label={feat.label}
                value={feat.value}
                unit={feat.unit}
                isAssumption={feat.source === "fixed_assumption"}
              />
            ))}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ps-text-muted">
            {hasAssumptions && "* fixed assumption, not a measured value. "}
            {inputs.disclaimer}
          </p>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-ps-text-muted">
          Model input features are not available right now.
        </p>
      )}
    </div>
  );
}
