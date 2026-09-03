"use client";

import { Lightbulb, RefreshCw } from "lucide-react";
import type { ExplanationData, AIInsight as AIInsightData } from "@/types/forecast";
import ExplanationDrivers from "@/components/forecast/ExplanationDrivers";

// ─── Live SHAP explanation mode ───────────────────────────────────────────────

function LiveInsight({ explanation }: { explanation: ExplanationData }) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ps-accent-soft text-ps-accent">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ps-text-primary">Why is this peak happening?</h2>
          <p className="mt-1 text-sm leading-relaxed text-ps-text-secondary">
            {explanation.summary}
          </p>
        </div>
      </div>

      <ExplanationDrivers
        drivers={explanation.drivers}
        baseValueMw={explanation.baseValueMw}
      />

      <p className="mt-3 pl-11 text-[11px] leading-relaxed text-ps-text-muted">
        Method: {explanation.method} · Values are bulk Mumbai demand contributions (MW),
        not per-locality. Locality prediction: {explanation.localityPredictionMw.toFixed(0)} MW.
      </p>
    </div>
  );
}

// ─── Fallback / loading modes ──────────────────────────────────────────────────

function DemoInsight({
  insight,
  status,
  onRetry,
}: {
  insight: AIInsightData;
  status: "demo" | "loading" | "error" | "fallback";
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ps-accent-soft text-ps-accent">
            {status === "loading" ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ps-text-primary">Why is this peak happening?</h2>
            {status === "loading" ? (
              <p className="mt-1 text-sm text-ps-text-muted">Computing explanation…</p>
            ) : (
              <p className="mt-1 text-sm text-ps-text-secondary">{insight.summary}</p>
            )}
          </div>
        </div>
        {(status === "error" || status === "fallback") && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex shrink-0 items-center gap-1 rounded border border-ps-border bg-ps-background px-2 py-1 text-xs font-medium text-ps-text-secondary transition-colors hover:bg-ps-border/40"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        )}
      </div>

      {status !== "loading" && insight.drivers.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-11">
          <span className="text-xs font-medium text-ps-text-muted">Primary drivers</span>
          {insight.drivers.map((driver) => (
            <span
              key={driver}
              className="rounded-full border border-ps-border bg-ps-background px-2 py-0.5 text-xs text-ps-text-secondary"
            >
              {driver}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Public export ─────────────────────────────────────────────────────────────

export type ExplanationStatus = "checking" | "live" | "fallback" | "error";

/**
 * AIInsight component — shows real SHAP explanation when backend is live,
 * or the demo insight while offline/loading/errored.
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
    return <LiveInsight explanation={explanation} />;
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
