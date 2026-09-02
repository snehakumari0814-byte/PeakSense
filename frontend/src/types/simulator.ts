/**
 * Types for the PeakSense What-If Simulator.
 *
 * This is a demand-response SCENARIO simulator, not a physical electrical
 * grid simulator. The baseline forecast is read from the same mock
 * forecast adapter used by the Forecast and Peak Prevention pages
 * (`lib/forecast.ts`) — this page never maintains a second forecast
 * dataset. Only the intervention math (how much each slider shaves off
 * the baseline) lives in `lib/simulator.ts`.
 *
 * Forward compatibility: shaped to match a future
 *   POST /api/simulate
 * endpoint —
 *   request:  { locality_id, interventions: { cooling_shift, commercial_shift, flexible_load, solar_utilization } }
 *   response: { baseline_peak_mw, scenario_peak_mw, reduction_mw, reduction_percent, baseline_risk, scenario_risk, peak_avoided }
 * — so `simulateScenario()` in lib/simulator.ts can be swapped for a real
 * `fetch` call without changing any component.
 */

import type { RiskLevel } from "@/lib/risk";

/** All fractions are 0-1 (e.g. 0.3 = 30%). Sliders cap cooling/commercial/flexible at 0.5, solar at 1.0. */
export type InterventionSettings = {
  coolingShift: number;
  commercialShift: number;
  flexibleLoad: number;
  solarUtilization: number;
};

export const DEFAULT_INTERVENTIONS: InterventionSettings = {
  coolingShift: 0,
  commercialShift: 0,
  flexibleLoad: 0,
  solarUtilization: 0,
};

export type ScenarioSeriesPoint = {
  timestamp: number;
  time: string;
  baselineMw: number | null;
  simulatedMw: number | null;
};

export type InterventionBreakdownItem = {
  key: keyof InterventionSettings;
  label: string;
  reductionMw: number;
};

export type BaselinePeak = {
  peakMw: number;
  peakTime: string;
  thresholdMw: number;
  risk: RiskLevel;
};

export type ScenarioPeak = {
  peakMw: number;
  peakTime: string;
  risk: RiskLevel;
  peakAvoided: boolean;
};

export type SimulationResult = {
  localityId: string;
  baseline: BaselinePeak;
  scenario: ScenarioPeak;
  reductionMw: number;
  reductionPct: number;
  breakdown: InterventionBreakdownItem[];
  series: ScenarioSeriesPoint[];
  /** True for the mock adapter; a real API response would omit or set this false. */
  isDemoData: true;
};
