"use client";

import { Lightbulb, RefreshCw } from "lucide-react";
import type { ExplanationData } from "@/types/forecast";
import DemoDataBadge from "@/components/DemoDataBadge";
import ExplanationDrivers from "@/components/forecast/ExplanationDrivers";

export type ExplanationStatus = "checking" | "live" | "fallback" | "error";

/**
 * Prevention page "Why is the peak happening?" explanation block.
 *
 * When live: shows the same SHAP explanation as the Forecast page
 * (fetched from the same GET /api/explanation endpoint).
 * When fallback/error/loading: shows the demo text with appropriate badge.
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
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isLive ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
          }`}
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
              Why is the peak happening?
            </h2>
            <div className="flex items-center gap-2">
              {isLive ? (
                <DemoDataBadge variant="live" label="SHAP · Live" />
              ) : explanationStatus === "fallback" || explanationStatus === "error" ? (
                <>
                  <DemoDataBadge variant="fallback" label="Demo Fallback" />
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-700 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </button>
                  )}
                </>
              ) : (
                <DemoDataBadge label="Demo" />
              )}
            </div>
          </div>

          {isLoading && (
            <p className="mt-2 text-sm text-slate-500">
              Computing SHAP explanation…
            </p>
          )}

          {isLive && explanation ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {explanation.summary}
              </p>
              <ExplanationDrivers
                drivers={explanation.drivers}
                baseValueMw={explanation.baseValueMw}
              />
              <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
                Method: {explanation.method} · Values are bulk Mumbai demand (MW).
                Locality peak: {explanation.localityPredictionMw.toFixed(0)} MW.
              </p>
            </>
          ) : (
            !isLoading && (
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {demoExplanationText}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
