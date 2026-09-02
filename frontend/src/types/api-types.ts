/**
 * Raw backend API response types (snake_case, exact JSON shape).
 *
 * These types mirror the Pydantic schemas in backend/app/schemas/forecast.py.
 * They are ONLY used inside the API adapter layer (src/lib/api.ts).
 * React components always receive the normalized frontend types from
 * src/types/forecast.ts — never these raw types.
 *
 * If the backend schema changes, update here and in api.ts only.
 */

export type ApiRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ApiForecastValues = {
  "15min_mw": number;
  "1hour_mw": number;
  "24hour_peak_mw": number;
};

export type ApiPeakAnalysis = {
  peak_mw: number;
  peak_time: string;
  threshold_mw: number;
  risk: ApiRiskLevel;
  probability: number | null;
  exceedance_mw: number | null;
  peak_window: string | null;
};

/** Response from GET /api/forecast */
export type ApiForecastResponse = {
  locality_id: string;
  locality_name: string;
  current_demand_mw: number;
  forecast: ApiForecastValues;
  peak: ApiPeakAnalysis;
  confidence: number;
  is_demo_fallback: boolean;
};

/** One point from GET /api/forecast/series */
export type ApiForecastPoint = {
  timestamp: string;
  actual_mw: number | null;
  predicted_mw: number;
  lower_bound_mw: number | null;
  upper_bound_mw: number | null;
};

/** Response from GET /api/forecast/series */
export type ApiForecastSeriesResponse = {
  locality_id: string;
  horizon: string;
  unit: string;
  points: ApiForecastPoint[];
  is_demo_fallback: boolean;
};

/** Per-horizon metrics from GET /api/model-metrics */
export type ApiModelHorizonMetrics = {
  mae: number;
  rmse: number;
  mape: number;
};

/**
 * Response from GET /api/model-metrics.
 * Keys are: "15min", "1hour", "24hour"
 */
export type ApiModelMetricsResponse = Record<string, ApiModelHorizonMetrics>;

/** Response from GET /api/health */
export type ApiHealthResponse = {
  status: "ok" | string;
};

/** One SHAP feature contribution from GET /api/explanation */
export type ApiFeatureContribution = {
  feature: string;
  label: string;
  shap_value_mw: number;
  direction: "increase" | "decrease";
  feature_value: number;
  category: "temporal" | "lag" | "rolling" | "weather" | "solar" | "other";
};

/** Response from GET /api/explanation */
export type ApiExplanationResponse = {
  locality_id: string;
  locality_name: string;
  horizon: string;
  prediction_mw: number;
  locality_prediction_mw: number;
  base_value_mw: number;
  drivers: ApiFeatureContribution[];
  summary: string;
  method: "SHAP_TreeExplainer";
  is_demo_fallback: boolean;
};

/** Request body for POST /api/simulate */
export type ApiSimulationRequest = {
  locality_id: string;
  horizon: "15min" | "1h" | "24h";
  cooling_shift: number;
  commercial_shift: number;
  flexible_load: number;
  solar_utilization: number;
};

/** One intervention breakdown item from POST /api/simulate */
export type ApiInterventionEffect = {
  key: string;
  label: string;
  activation_level: number;
  estimated_reduction_mw: number;
};

/** One time-series point in the backend-generated scenario chart */
export type ApiScenarioSeriesPoint = {
  timestamp: string;
  time: string;
  baseline_mw: number;
  simulated_mw: number;
  threshold_mw: number;
};

/** Response from POST /api/simulate */
export type ApiSimulationResponse = {
  locality_id: string;
  locality_name: string;
  horizon: string;
  baseline_peak_mw: number;
  baseline_peak_time: string;
  baseline_risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  threshold_mw: number;
  scenario_peak_mw: number;
  scenario_peak_time: string;
  scenario_risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  peak_avoided: boolean;
  exceedance_mw: number;
  reduction_mw: number;
  reduction_pct: number;
  interventions: ApiInterventionEffect[];
  /** Backend-generated scenario chart series. max(simulated_mw) == scenario_peak_mw */
  scenario_series: ApiScenarioSeriesPoint[];
  inputs: ApiSimulationRequest;
  simulation_method: string;
  is_demo_fallback: boolean;
};

// ─── Forecast Inputs ──────────────────────────────────────────────────────────

export type ApiForecastInputSource =
  | "historical_lag"
  | "model_computed"
  | "fixed_assumption"
  | "calendar";

/** A single model input feature with its actual value and provenance */
export type ApiForecastInputFeature = {
  feature: string;
  label: string;
  value: number;
  unit: string;
  source: ApiForecastInputSource;
  source_note: string;
};

/** Response from GET /api/forecast/inputs */
export type ApiForecastInputsResponse = {
  locality_id: string;
  locality_name: string;
  horizon: string;
  peak_hour: number;
  features: ApiForecastInputFeature[];
  disclaimer: string;
  is_demo_fallback: boolean;
};

// ─── Recommendations ──────────────────────────────────────────────────────────

/** One ranked recommendation from GET /api/recommendations */
export type ApiRecommendationItem = {
  intervention: string;
  title: string;
  reason: string;
  scenario_percentage: number;
  estimated_reduction_mw: number;
  rank: number;
};

/** Response from GET /api/recommendations */
export type ApiRecommendationsResponse = {
  locality_id: string;
  locality_name: string;
  horizon: string;
  recommendations: ApiRecommendationItem[];
  scenario_note: string;
  method: string;
  is_demo_fallback: boolean;
};
