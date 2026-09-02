"use client";

import { Lightbulb, RefreshCw } from "lucide-react";
import type { ExplanationData, AIInsight as AIInsightData } from "@/types/forecast";
import DemoDataBadge from "@/components/DemoDataBadge";
import ExplanationDrivers from "@/components/forecast/ExplanationDrivers";

// ─── Live SHAP explanation mode ───────────────────────────────────────────────

function LiveInsight({
  explanation,
  onRetry,
}: {
  explanation: ExplanationData;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Lightbulb className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Model Explanation</h2>
              <DemoDataBadge variant="live" label="SHAP · Live" />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {explanation.summary}
            </p>
          </div>
        </div>
      </div>

      <ExplanationDrivers
        drivers={explanation.drivers}
        baseValueMw={explanation.baseValueMw}
      />

      <p className="mt-3 pl-11 text-[10px] leading-relaxed text-slate-600">
        Method: {explanation.method} · Values are bulk Mumbai demand contributions (MW),
        not per-locality. Locality prediction: {explanation.localityPredictionMw.toFixed(0)} MW.
        Mathematical identity: {explanation.baseValueMw.toFixed(0)} MW base + SHAP sum ≈ {explanation.predictionMw.toFixed(0)} MW bulk prediction.
      </p>
    </div>
  );
}

// ─── Demo / loading / error modes ─────────────────────────────────────────────

function DemoInsight({
  insight,
  status,
  onRetry,
}: {
  insight: AIInsightData;
  status: "demo" | "loading" | "error" | "fallback";
  onRetry?: () => void;
}) {
  const badgeVariant = status === "fallback" ? "fallback" : "demo";
  const badgeLabel = status === "loading" ? "Loading…" : status === "fallback" ? "Demo Fallback" : "Demo";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
            {status === "loading" ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">AI Insight</h2>
              <DemoDataBadge variant={badgeVariant} label={badgeLabel} />
            </div>
            {status === "loading" ? (
              <p className="mt-1 text-sm text-slate-500">Computing SHAP explanation…</p>
            ) : (
              <p className="mt-1 text-sm text-slate-300">{insight.summary}</p>
            )}
          </div>
        </div>
        {(status === "error" || status === "fallback") && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex shrink-0 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        )}
      </div>

      {status !== "loading" && insight.drivers.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-4 pl-11">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Primary drivers
            </span>
            {insight.drivers.map((driver) => (
              <span
                key={driver}
                className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300"
              >
                {driver}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Public export ─────────────────────────────────────────────────────────────

export type ExplanationStatus = "checking" | "live" | "fallback" | "error";

/**
 * AIInsight component — shows real SHAP explanation when backend is live,
 * or the demo insight with appropriate badge when offline/loading/errored.
 */
export default function AIInsight({
  insight,
  explanation,
  explanationStatus,
  onRetryExplanation,
}: {
  /** Demo fallback insight (always provided) */
  insight: AIInsightData;
  /** Real SHAP explanation from GET /api/explanation — null while loading or on error */
  explanation: ExplanationData | null;
  explanationStatus: ExplanationStatus;
  onRetryExplanation?: () => void;
}) {
  if (explanationStatus === "live" && explanation !== null) {
    return <LiveInsight explanation={explanation} onRetry={onRetryExplanation} />;
  }

  const demoStatus =
    explanationStatus === "checking"
      ? "loading"
      : explanationStatus === "error"
      ? "error"
      : explanationStatus === "fallback"
      ? "fallback"
      : "demo";

  return (
    <DemoInsight
      insight={insight}
      status={demoStatus}
      onRetry={onRetryExplanation}
    />
  );
}
