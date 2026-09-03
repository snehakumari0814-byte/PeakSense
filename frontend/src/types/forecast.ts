/**
 * Types for the PeakSense Forecast page.
 *
 * Phase 7: Real ML backend is now integrated.
 * - fetchForecast(), fetchForecastSeries(), fetchModelAccuracy() in lib/api.ts
 *   return these normalized types from the FastAPI backend.
 * - Mock functions in lib/forecast.ts are preserved as demo fallback only.
 * - isDemoData is `boolean` — false when data comes from the real ML model,
 *   true when the mock fallback is used (e.g. backend offline).
 *
 * Backend endpoints:
 *   GET /api/forecast          -> ForecastResponse (minus inputs/insight)
 *   GET /api/forecast/series   -> ForecastSeries
 *   GET /api/model-metrics     -> ModelAccuracy
 */

import type { RiskLevel } from "@/lib/risk";

export type ForecastHorizon = "15m" | "1h" | "24h";

export const FORECAST_HORIZONS: ForecastHorizon[] = ["15m", "1h", "24h"];

export const HORIZON_LABELS: Record<ForecastHorizon, string> = {
  "15m": "15 MIN",
  "1h": "1 HOUR",
  "24h": "24 HOURS",
};

/** One point on the forecast chart. `actualMw`/`predictedMw` overlap at the "now" boundary. */
export type ForecastPoint = {
  timestamp: number;
  time: string;
  actualMw: number | null;
  predictedMw: number | null;
  lowerMw: number | null;
  upperMw: number | null;
};

export type ForecastSeries = {
  localityId: string;
  horizon: ForecastHorizon;
  points: ForecastPoint[];
  /** Real value from the locality API — not mocked. */
  thresholdMw: number;
  peakTimestamp: number;
  peakMw: number;
  /**
   * "YYYY-MM-DD" calendar date this series was generated for — echoed
   * directly from the backend's `date` field on GET /api/forecast/series,
   * confirming the date actually served (defends against any client/server
   * date-resolution mismatch).
   */
  referenceDate: string;
  /** How this series was produced: real backtest, live forecast, or bounded future extrapolation. */
  dataMode: "historical" | "current" | "future";
};

export type ForecastSummary = {
  localityId: string;
  horizon: ForecastHorizon;
  currentLoadMw: number;
  currentLoadChangePct: number;
  predictedPeakMw: number;
  predictedPeakWindow: { start: string; end: string };
  peakTime: string;
  peakProbabilityPct: number;
};

export type PeakAnalysis = {
  predictedPeakMw: number;
  thresholdMw: number;
  exceedanceMw: number;
  peakTime: string;
  risk: RiskLevel;
  peakProbabilityPct: number;
};

export type ForecastInputSource =
  | "historical_lag"
  | "model_computed"
  | "fixed_assumption"
  | "calendar";

/**
 * A single model input feature with its actual value and source provenance.
 * source_note explains honestly how the value was obtained.
 */
export type ForecastInputFeatureItem = {
  feature: string;
  label: string;
  value: number;
  unit: string;
  source: ForecastInputSource;
  source_note: string;
};

/** Model input features for the Forecast Inputs panel. */
export type ForecastInputs = {
  /** The actual feature values returned by GET /api/forecast/inputs */
  features: ForecastInputFeatureItem[];
  /** Hour (0–23) of the predicted peak step */
  peakHour: number;
  /** Provenance disclaimer from the backend */
  disclaimer: string;
};

export type AIInsight = {
  summary: string;
  drivers: string[];
};

export type AccuracyMetric = {
  maeMw: number;
  rmseMw: number;
  mapePct: number;
};

export type ModelAccuracy = Record<ForecastHorizon, AccuracyMetric>;

export type ForecastResponse = {
  localityId: string;
  horizon: ForecastHorizon;
  date: string;
  dataMode: "historical" | "current" | "future";
  summary: ForecastSummary;
  peakAnalysis: PeakAnalysis;
  inputs: ForecastInputs;
  insight: AIInsight;
  /** True when data comes from mock/fallback; false when real ML backend responded. */
  isDemoData: boolean;
};

/**
 * One SHAP feature contribution (normalized, camelCase frontend type).
 * shap_value_mw is in BULK Mumbai MW (the model's native output unit),
 * not per-locality MW. The UI must communicate this clearly.
 */
export type FeatureDriver = {
  feature: string;
  label: string;
  /** SHAP contribution in bulk Mumbai MW. Positive = pushes prediction up. */
  shapValueMw: number;
  direction: "increase" | "decrease";
  /** Actual input value that the model received for this feature */
  featureValue: number;
  category: "temporal" | "lag" | "rolling" | "weather" | "solar" | "other";
};

/**
 * Full SHAP explanation bundle for one locality+horizon.
 * Returned by GET /api/explanation.
 * Mathematical identity: predictionMw ≈ baseValueMw + sum(driver.shapValueMw)
 */
export type ExplanationData = {
  localityId: string;
  localityName: string;
  horizon: ForecastHorizon;
  /** Calendar date ("YYYY-MM-DD") this explanation corresponds to */
  date: string;
  /** Bulk Mumbai model prediction (MW) for the peak point */
  predictionMw: number;
  /** Locality-scaled peak demand prediction (MW) */
  localityPredictionMw: number;
  /** SHAP expected model output (average training prediction, MW) */
  baseValueMw: number;
  /** Top-N SHAP contributors sorted by |shapValueMw| descending */
  drivers: FeatureDriver[];
  /** Deterministic summary derived from SHAP values — no LLM */
  summary: string;
  method: "SHAP_TreeExplainer";
  isDemoFallback: boolean;
};
