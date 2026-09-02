/**
 * Types for the PeakSense Mumbai Digital Twin locality data.
 *
 * These localities are PROTOTYPE zones for the hackathon demo and all
 * numeric fields are DEMO/SEEDED values from the backend — not official
 * electricity-grid boundaries or real utility measurements.
 *
 * Forward compatibility: this type mirrors the backend's Locality model
 * exactly (no frontend-only duplicate fields). When the backend adds
 * forecasting fields (e.g. forecast_15min_mw, forecast_1hour_mw,
 * forecast_24hour_peak_mw, peak_time, peak_risk, probability, confidence,
 * solar_generation_mw, net_demand_mw), add them here and to
 * `buildMetrics()` in LocalityInfoPanel — the 3D scene, risk logic, and
 * panel layout do not need to be redesigned to surface new fields.
 */

export type DemandProfile =
  | "residential_evening_peak"
  | "commercial_daytime_peak"
  | "mixed_dual_peak"
  | "industrial_flat";

export type Locality = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  residential_share: number;
  commercial_share: number;
  solar_capacity_mw: number;
  typical_peak_hour: number;
  demand_profile: DemandProfile;
  cooling_sensitivity: number;
  current_demand_mw: number;
  peak_threshold_mw: number;
};

export const DEMAND_PROFILE_LABELS: Record<DemandProfile, string> = {
  residential_evening_peak: "Residential evening peak",
  commercial_daytime_peak: "Commercial daytime peak",
  mixed_dual_peak: "Mixed dual peak",
  industrial_flat: "Industrial (flat)",
};
