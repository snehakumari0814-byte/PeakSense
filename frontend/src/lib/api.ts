/**
 * PeakSense centralized API client.
 *
 * All fetch() calls live here. React components and lib adapters call
 * these functions — they never call fetch() directly.
 *
 * Adapter functions translate raw backend snake_case responses into the
 * frontend camelCase types defined in src/types/forecast.ts so that
 * no component ever sees raw API types.
 */

import type { Locality } from "@/types/locality";
import type {
  AccuracyMetric,
  ExplanationData,
  FeatureDriver,
  ForecastHorizon,
  ForecastPoint,
  ForecastResponse,
  ForecastSeries,
  ForecastSummary,
  ModelAccuracy,
  PeakAnalysis,
} from "@/types/forecast";
import type {
  ApiModelMetricsResponse,
  ApiForecastResponse,
  ApiForecastSeriesResponse,
  ApiExplanationResponse,
  ApiSimulationRequest,
  ApiSimulationResponse,
  ApiScenarioSeriesPoint,
  ApiForecastInputsResponse,
} from "@/types/api-types";
import type { ForecastInputs, ForecastInputFeatureItem } from "@/types/forecast";
import type {
  InterventionBreakdownItem,
  InterventionSettings,
  SimulationResult,
  ScenarioSeriesPoint,
} from "@/types/simulator";
import type { RiskLevel } from "@/lib/risk";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ─── Horizon key mapping ──────────────────────────────────────────────────────

/**
 * Frontend uses "15m" | "1h" | "24h".
 * Backend accepts  "15min" | "1h" | "24h".
 */
function toBackendHorizon(h: ForecastHorizon): string {
  if (h === "15m") return "15min";
  return h;
}

/** Metric response key mapping: "15m" → "15min", "1h" → "1hour", "24h" → "24hour" */
const METRIC_KEY_MAP: Record<ForecastHorizon, string> = {
  "15m": "15min",
  "1h": "1hour",
  "24h": "24hour",
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function isoToTimeString(iso: string): string {
  // Extract "HH:MM" from ISO timestamp "2026-09-02T20:15:00+05:30"
  const tPart = iso.split("T")[1];
  if (!tPart) return iso;
  return tPart.slice(0, 5);
}

function parsePeakWindow(
  raw: string | null,
): { start: string; end: string } {
  if (!raw) return { start: "—", end: "—" };
  // Format: "18:30 - 21:00" or single "19:00"
  const parts = raw.split(" - ");
  if (parts.length === 2) return { start: parts[0], end: parts[1] };
  return { start: raw, end: raw };
}

// ─── Adapter: ApiForecastResponse → ForecastResponse ─────────────────────────

function adaptForecastResponse(
  api: ApiForecastResponse,
  horizon: ForecastHorizon,
): ForecastResponse {
  const peakWindow = parsePeakWindow(api.peak.peak_window ?? null);
  const probabilityPct = api.peak.probability !== null
    ? Math.round(api.peak.probability * 100)
    : 0;

  const summary: ForecastSummary = {
    localityId: api.locality_id,
    horizon,
    currentLoadMw: api.current_demand_mw,
    // Backend does not provide change %. Keep as 0 (shown as demo in UI).
    currentLoadChangePct: 0,
    predictedPeakMw: api.peak.peak_mw,
    predictedPeakWindow: peakWindow,
    peakTime: api.peak.peak_time,
    peakProbabilityPct: probabilityPct,
  };

  const peakAnalysis: PeakAnalysis = {
    predictedPeakMw: api.peak.peak_mw,
    thresholdMw: api.peak.threshold_mw,
    exceedanceMw: api.peak.exceedance_mw ?? 0,
    peakTime: api.peak.peak_time,
    risk: api.peak.risk,
    peakProbabilityPct: probabilityPct,
  };

  return {
    localityId: api.locality_id,
    horizon,
    summary,
    peakAnalysis,
    // Inputs are now fetched separately via fetchForecastInputs() (GET /api/forecast/inputs).
    // This stub is kept to satisfy ForecastResponse.inputs — the Forecast page ignores it.
    inputs: {
      features: [],
      peakHour: 0,
      disclaimer: "",
    },
    // AI insight is not provided by the backend yet — kept as DEMO in UI
    insight: {
      summary: "",
      drivers: [],
    },
    isDemoData: true, // ForecastResponse type requires this field
  };
}

// ─── Adapter: ApiForecastSeriesResponse → ForecastSeries ────────────────────

function adaptForecastSeries(
  api: ApiForecastSeriesResponse,
  thresholdMw: number,
  horizon: ForecastHorizon,
): ForecastSeries {
  const points: ForecastPoint[] = api.points.map((p) => ({
    timestamp: new Date(p.timestamp).getTime(),
    time: isoToTimeString(p.timestamp),
    actualMw: p.actual_mw,
    predictedMw: p.predicted_mw,
    lowerMw: p.lower_bound_mw,
    upperMw: p.upper_bound_mw,
  }));

  // Find peak: point with highest predicted demand
  const futurePoints = points.filter((p) => p.predictedMw !== null);
  const peakPoint = futurePoints.reduce(
    (best, p) =>
      (p.predictedMw ?? 0) > (best.predictedMw ?? 0) ? p : best,
    futurePoints[0] ?? points[points.length - 1],
  );

  return {
    localityId: api.locality_id,
    horizon,
    points,
    thresholdMw,
    peakTimestamp: peakPoint?.timestamp ?? 0,
    peakMw: peakPoint?.predictedMw ?? 0,
  };
}

// ─── Adapter: ApiModelMetricsResponse → ModelAccuracy ────────────────────────

function adaptModelMetrics(api: ApiModelMetricsResponse): ModelAccuracy {
  function extractHorizon(key: string): AccuracyMetric {
    const raw = api[key];
    if (!raw) return { maeMw: 0, rmseMw: 0, mapePct: 0 };
    return {
      maeMw: raw.mae,
      rmseMw: raw.rmse,
      mapePct: raw.mape,
    };
  }

  return {
    "15m": extractHorizon(METRIC_KEY_MAP["15m"]),
    "1h": extractHorizon(METRIC_KEY_MAP["1h"]),
    "24h": extractHorizon(METRIC_KEY_MAP["24h"]),
  };
}

// ─── Public API functions ─────────────────────────────────────────────────────

export async function fetchLocalities(): Promise<Locality[]> {
  const res = await fetch(`${API_BASE_URL}/api/localities`);
  if (!res.ok) {
    throw new ApiError("Failed to fetch localities", res.status);
  }
  return res.json();
}

export async function fetchLocality(id: string): Promise<Locality> {
  const res = await fetch(
    `${API_BASE_URL}/api/localities/${encodeURIComponent(id)}`,
  );
  if (!res.ok) {
    throw new ApiError(`Failed to fetch locality '${id}'`, res.status);
  }
  return res.json();
}

/**
 * Fetch forecast summary from the real ML backend.
 * Returns normalized ForecastResponse (minus inputs/insight which stay DEMO).
 * Throws ApiError on network or HTTP failure.
 */
export async function fetchForecast(
  localityId: string,
  horizon: ForecastHorizon,
): Promise<{ data: ForecastResponse; isDemoFallback: boolean }> {
  const params = new URLSearchParams({
    locality_id: localityId,
    horizon: toBackendHorizon(horizon),
  });
  const res = await fetch(`${API_BASE_URL}/api/forecast?${params}`);
  if (!res.ok) {
    throw new ApiError(
      `Forecast fetch failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const raw: ApiForecastResponse = await res.json();
  return {
    data: adaptForecastResponse(raw, horizon),
    isDemoFallback: raw.is_demo_fallback,
  };
}

/**
 * Fetch forecast time-series for the chart from the real ML backend.
 * Returns normalized ForecastSeries.
 * Throws ApiError on network or HTTP failure.
 */
export async function fetchForecastSeries(
  localityId: string,
  horizon: ForecastHorizon,
  thresholdMw: number,
): Promise<{ data: ForecastSeries; isDemoFallback: boolean }> {
  const params = new URLSearchParams({
    locality_id: localityId,
    horizon: toBackendHorizon(horizon),
  });
  const res = await fetch(`${API_BASE_URL}/api/forecast/series?${params}`);
  if (!res.ok) {
    throw new ApiError(
      `Forecast series fetch failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const raw: ApiForecastSeriesResponse = await res.json();
  return {
    data: adaptForecastSeries(raw, thresholdMw, horizon),
    isDemoFallback: raw.is_demo_fallback,
  };
}

/**
 * Fetch real model accuracy metrics from the backend.
 * Returns normalized ModelAccuracy (all three horizons).
 * Throws ApiError on network or HTTP failure.
 */
export async function fetchModelAccuracy(): Promise<{
  data: ModelAccuracy;
  isDemoFallback: boolean;
}> {
  const res = await fetch(`${API_BASE_URL}/api/model-metrics`);
  if (!res.ok) {
    throw new ApiError(
      `Model metrics fetch failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const raw: ApiModelMetricsResponse = await res.json();
  return { data: adaptModelMetrics(raw), isDemoFallback: false };
}

/**
 * Check if the backend is reachable.
 * Returns true if /api/health responds 200 with {status: "ok"}.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.status === "ok";
  } catch {
    return false;
  }
}

// ─── Adapter: ApiExplanationResponse → ExplanationData ───────────────────────

function adaptExplanation(
  api: ApiExplanationResponse,
  horizon: ForecastHorizon,
): ExplanationData {
  const drivers: FeatureDriver[] = api.drivers.map((d) => ({
    feature: d.feature,
    label: d.label,
    shapValueMw: d.shap_value_mw,
    direction: d.direction,
    featureValue: d.feature_value,
    category: d.category,
  }));

  return {
    localityId: api.locality_id,
    localityName: api.locality_name,
    horizon,
    predictionMw: api.prediction_mw,
    localityPredictionMw: api.locality_prediction_mw,
    baseValueMw: api.base_value_mw,
    drivers,
    summary: api.summary,
    method: api.method,
    isDemoFallback: api.is_demo_fallback,
  };
}

/**
 * Fetch SHAP-based explanation for the peak-point forecast prediction.
 * Returns normalized ExplanationData.
 * Throws ApiError on network or HTTP failure.
 */
export async function fetchExplanation(
  localityId: string,
  horizon: ForecastHorizon,
): Promise<{ data: ExplanationData; isDemoFallback: boolean }> {
  const params = new URLSearchParams({
    locality_id: localityId,
    horizon: toBackendHorizon(horizon),
  });
  const res = await fetch(`${API_BASE_URL}/api/explanation?${params}`);
  if (!res.ok) {
    throw new ApiError(
      `Explanation fetch failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const raw: ApiExplanationResponse = await res.json();
  return {
    data: adaptExplanation(raw, horizon),
    isDemoFallback: raw.is_demo_fallback,
  };
}

// ─── Adapter: ApiSimulationResponse → SimulationResult ────────────────────

function adaptSimulation(api: ApiSimulationResponse): SimulationResult {
  const baseline = {
    peakMw: api.baseline_peak_mw,
    peakTime: api.baseline_peak_time,
    thresholdMw: api.threshold_mw,
    risk: api.baseline_risk as RiskLevel,
  };
  const scenario = {
    peakMw: api.scenario_peak_mw,
    peakTime: api.scenario_peak_time,
    risk: api.scenario_risk as RiskLevel,
    peakAvoided: api.peak_avoided,
  };
  const breakdown: InterventionBreakdownItem[] = api.interventions.map((i) => ({
    key: i.key as keyof InterventionSettings,
    label: i.label,
    reductionMw: i.estimated_reduction_mw,
  }));

  // Scenario series comes directly from the backend.
  // The backend guarantees max(simulated_mw) == scenario_peak_mw (±0.1 MW).
  // No client-side arithmetic here — the frontend is a pure renderer.
  const series: ScenarioSeriesPoint[] = api.scenario_series.map(
    (p: ApiScenarioSeriesPoint) => ({
      timestamp: p.timestamp,
      time: p.time,
      baselineMw: p.baseline_mw,
      simulatedMw: p.simulated_mw,
    }),
  );

  return {
    localityId: api.locality_id,
    baseline,
    scenario,
    reductionMw: api.reduction_mw,
    reductionPct: api.reduction_pct,
    breakdown,
    series,
    isDemoData: false,
  };
}

/**
 * POST /api/simulate — run a demand-response scenario simulation.
 *
 * Sends intervention values to the backend. The backend returns:
 *   - baseline peak (from ForecastEngine, same as GET /api/forecast)
 *   - scenario peak, risk, reduction_mw, reduction_pct
 *   - per-intervention breakdown (backend-generated)
 *   - scenario_series: per-point chart data (backend-generated)
 *
 * The frontend adapter is a pure renderer — no client-side simulation arithmetic.
 *
 * Throws ApiError on network or HTTP failure.
 */
export async function postSimulate(
  localityId: string,
  horizon: import("@/types/forecast").ForecastHorizon,
  interventions: InterventionSettings,
): Promise<{ data: SimulationResult; isDemoFallback: boolean }> {
  const backendHorizon = toBackendHorizon(horizon);
  const reqBody: ApiSimulationRequest = {
    locality_id: localityId,
    horizon: backendHorizon as "15min" | "1h" | "24h",
    cooling_shift: interventions.coolingShift,
    commercial_shift: interventions.commercialShift,
    flexible_load: interventions.flexibleLoad,
    solar_utilization: interventions.solarUtilization,
  };

  const res = await fetch(`${API_BASE_URL}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });

  if (!res.ok) {
    throw new ApiError(
      `Simulation failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }

  const raw: ApiSimulationResponse = await res.json();
  return {
    data: adaptSimulation(raw),
    isDemoFallback: raw.is_demo_fallback,
  };
}

// ─── Adapter: ApiForecastInputsResponse → ForecastInputs ──────────────────

function adaptForecastInputs(api: ApiForecastInputsResponse): ForecastInputs {
  const features: ForecastInputFeatureItem[] = api.features.map((f) => ({
    feature: f.feature,
    label: f.label,
    value: f.value,
    unit: f.unit,
    source: f.source as ForecastInputFeatureItem["source"],
    source_note: f.source_note,
  }));
  return {
    features,
    peakHour: api.peak_hour,
    disclaimer: api.disclaimer,
  };
}

/**
 * GET /api/forecast/inputs — actual model input feature values at the peak point.
 *
 * Returns provenance-annotated feature values (temperature, humidity, solar,
 * lag demand, calendar features). Values are model-computed or historical —
 * NOT externally measured sensor data. The source/source_note fields document
 * exactly how each value was obtained.
 *
 * Throws ApiError on network or HTTP failure.
 */
export async function fetchForecastInputs(
  localityId: string,
  horizon: import("@/types/forecast").ForecastHorizon,
): Promise<{ data: ForecastInputs; isDemoFallback: boolean }> {
  const backendHorizon = toBackendHorizon(horizon);
  const url = `${API_BASE_URL}/api/forecast/inputs?locality_id=${encodeURIComponent(localityId)}&horizon=${encodeURIComponent(backendHorizon)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(
      `Forecast inputs fetch failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }

  const raw: ApiForecastInputsResponse = await res.json();
  return {
    data: adaptForecastInputs(raw),
    isDemoFallback: raw.is_demo_fallback,
  };
}
