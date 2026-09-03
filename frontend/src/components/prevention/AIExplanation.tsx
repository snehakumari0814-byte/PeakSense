"use client";

import { Lightbulb, RefreshCw } from "lucide-react";
import type { ExplanationData } from "@/types/forecast";
import ExplanationDrivers from "@/components/forecast/ExplanationDrivers";

export type ExplanationStatus = "checking" | "live" | "fallback" | "error";

/**
 * Prevention page "Why is the peak happening?" explanation block.
 *
 * When live: shows the same SHAP explanation as the Forecast page
 * (fetched from the same GET /api/explanation endpoint).
 * When fallback/error/loading: shows the demo text.
 */
export default function AIExplanation({
  explanation,
  explanationStatus,
  demoExplanationText,
  onRetry,
}: {
  explanation: ExplanationData | null;
  explanationStatus: ExplanationStatus;
  demoExplanationText: string;
  onRetry?: () => void;
}) {
  const isLive = explanationStatus === "live" && explanation !== null;
  const isLoading = explanationStatus === "checking";

  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ps-accent-soft text-ps-accent">
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ps-text-primary">Why is the peak happening?</h2>
            {(explanationStatus === "fallback" || explanationStatus === "error") && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-1 rounded border border-ps-border bg-ps-background px-2 py-0.5 text-xs font-medium text-ps-text-secondary hover:text-ps-text-primary"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            )}
          </div>

          {isLoading && (
            <p className="mt-2 text-sm text-ps-text-muted">
              Computing explanation…
            </p>
          )}

          {isLive && explanation ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-ps-text-secondary">
                {explanation.summary}
              </p>
              <ExplanationDrivers
                drivers={explanation.drivers}
                baseValueMw={explanation.baseValueMw}
              />
              <p className="mt-3 text-[11px] leading-relaxed text-ps-text-muted">
                Method: {explanation.method} · Values are bulk Mumbai demand (MW).
                Locality peak: {explanation.localityPredictionMw.toFixed(0)} MW.
              </p>
            </>
          ) : (
            !isLoading && (
              <p className="mt-2 text-sm leading-relaxed text-ps-text-secondary">
                {demoExplanationText}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
