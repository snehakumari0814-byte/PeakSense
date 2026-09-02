/**
 * Types for the PeakSense Peak Prevention page.
 *
 * Phase 9C: All fields are now live-capable from the real ML backend.
 *
 * Forward references:
 *   PeakDriver.shapValueMw   — from GET /api/explanation (SHAP TreeExplainer)
 *   Recommendation.simulatedReductionMw — from POST /api/simulate
 *   PeakReduction.isDemoData — false when POST /api/simulate was used
 *   TimelineEvent            — derived from ForecastSeries real timestamps
 */

import type { RiskLevel } from "@/lib/risk";

export type PeakDriver = {
  name: string;
  /**
   * Normalized model contribution share (0–100).
   * Formula: |shap_value| / sum(|all_shap_values|) × 100
   * NOT a load percentage — a model contribution share.
   */
  contributionPct: number;
  /**
   * Raw SHAP value in bulk Mumbai MW (the model's native unit).
   * Null when derived from mock/fallback.
   */
  shapValueMw: number | null;
  direction: "increase" | "decrease";
  /** Feature category from the SHAP explanation engine */
  category: string;
};

export type RecommendationImpact = {
  type: "reduction" | "support";
  minMw: number;
  maxMw: number;
};

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  /**
   * Simulation-backed reduction estimate from POST /api/simulate.
   * Null when simulation is unavailable (fallback).
   */
  simulatedReductionMw: number | null;
  /** Short explanation of why this intervention was prioritized. */
  driverBasis: string;
  /** Only present for fallback mock recommendations. */
  impact?: RecommendationImpact;
};

export type TimelineEvent = {
  timestamp: number;
  time: string;
  label: string;
  risk: RiskLevel;
  isPeak: boolean;
};

export type PeakReduction = {
  baselinePeakMw: number;
  potentialReductionMw: number;
  potentialPeakMw: number;
  /** True when values come from the mock fallback, not a real simulation */
  isDemoData: boolean;
  /** Human-readable description of the scenario used */
  scenarioDescription: string;
};

/**
 * Full prevention bundle for one locality.
 *
 * Phase 9C live sources:
 *   peak time/MW/threshold/risk/probability — GET /api/forecast (ForecastEngine)
 *   explanation text                        — GET /api/explanation (SHAP)
 *   drivers (SHAP contributors)             — GET /api/explanation (SHAP)
 *   recommendations                         — SHAP category mapping + POST /api/simulate
 *   timeline                                — ForecastSeries real timestamps
 *   reduction opportunity                   — POST /api/simulate (moderate scenario)
 */
export type PreventionData = {
  localityId: string;
  peakTime: string;
  peakWindow: { start: string; end: string };
  risk: RiskLevel;
  peakProbabilityPct: number;
  expectedDemandMw: number;
  thresholdMw: number;
  exceedanceMw: number;
  explanation: string;
  drivers: PeakDriver[];
  recommendations: Recommendation[];
  timeline: TimelineEvent[];
  reduction: PeakReduction;
  /**
   * True only when ALL sections are mock-derived.
   * False when real backend data is available for at least core fields.
   */
  isDemoData: boolean;
};
