/**
 * Types for the PeakSense What-If Simulator.
 *
 * Phase 9 update: POST /api/simulate now powers the real simulation.
 * The backend uses the same ForecastEngine for the baseline — no duplicate forecast.
 * Frontend sends InterventionSettings → receives SimulationResult via the API adapter.
 *
 * simulateScenario() in lib/simulator.ts → POST /api/simulate (live) or local
 * math (fallback). The return type is SimulationResult in both cases.
 *
 * IMPORTANT: This is a demand-response SCENARIO simulator, not a physical
 * electrical grid simulator. Results are scenario estimates, not measured outcomes.
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
  /** ISO 8601 timestamp string from backend (e.g. "2026-09-02T21:24:00+05:30") */
  timestamp: string;
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
  /**
   * True when this result comes from the local mock fallback.
   * False when it comes from POST /api/simulate (live backend).
   */
  isDemoData: boolean;
};
