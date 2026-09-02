/**
 * Types for the PeakSense Peak Prevention page.
 *
 * IMPORTANT: There is no explanation/recommendation ML backend yet. Every
 * value here is produced by the local adapter in `src/lib/prevention.ts`,
 * which itself reuses `mockForecast()` / `mockForecastSeries()` from
 * `src/lib/forecast.ts` for the underlying peak numbers — this page does
 * NOT maintain a second, independent forecast dataset. Only the
 * prevention-specific pieces (driver contributions, explanation text,
 * recommendations, timeline, reduction opportunity) are invented here.
 *
 * Forward compatibility: shaped to match two future backend endpoints —
 *   GET /api/explanation     -> { locality_id, peak_time, risk, drivers, explanation }
 *   GET /api/recommendations -> { locality_id, recommendations }
 * — so `mockPreventionData()` can be replaced by real `fetch` calls without
 * changing any component. See the JSDoc on `PreventionData` for the exact
 * future response shape this maps to.
 */

import type { RiskLevel } from "@/lib/risk";

export type PeakDriver = {
  name: string;
  /** 0-100. Demo contribution percentage, not real feature importance. */
  contributionPct: number;
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
  impact: RecommendationImpact;
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
};

/**
 * Full prevention bundle for one locality.
 *
 * Future response shape (see GET /api/explanation + GET /api/recommendations):
 * {
 *   "locality_id": "andheri",
 *   "peak_time": "20:02",
 *   "risk": "CRITICAL",
 *   "drivers": [{ "name": "Cooling demand", "contribution": 0.38 }],
 *   "explanation": "...",
 *   "recommendations": [{ "action": "...", "estimated_reduction_mw": 10 }]
 * }
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
  /** True for the mock adapter; a real API response would omit or set this false. */
  isDemoData: true;
};
