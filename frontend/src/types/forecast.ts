/**
 * Types for the PeakSense Forecast page.
 *
 * IMPORTANT: There is no ML forecasting backend yet. Every value described
 * here as "mock" or "demo" is produced by the local adapter in
 * `src/lib/forecast.ts`, not a real model. Fields that already come from
 * the real locality API (current demand, peak threshold, risk) are passed
 * straight through from `Locality` / `riskLevel()` rather than re-invented,
 * so this page never maintains a second copy of real backend data.
 *
 * Forward compatibility: these shapes are designed to match three future
 * backend endpoints —
 *   GET /api/forecast          -> ForecastResponse (minus `series`)
 *   GET /api/forecast/series   -> ForecastSeries
 *   GET /api/model-metrics     -> ModelAccuracy
 * — so `mockForecast()` / `mockForecastSeries()` / `mockModelAccuracy()`
 * in lib/forecast.ts can be swapped for real `fetch` calls without
 * changing any component.
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

/** Model input features. Placeholders until the ML backend supplies real values. */
export type ForecastInputs = {
  temperatureC: number;
  humidityPct: number;
  hour: string;
  day: string;
  isHoliday: boolean;
  previousDemandMw: number;
  solarGenerationMw: number;
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
  summary: ForecastSummary;
  peakAnalysis: PeakAnalysis;
  inputs: ForecastInputs;
  insight: AIInsight;
  /** True for the mock adapter; a real API response would omit or set this false. */
  isDemoData: true;
};
