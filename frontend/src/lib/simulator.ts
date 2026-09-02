/**
 * PeakSense What-If Simulator adapter — PROTOTYPE / DEMO SCENARIO ESTIMATE ONLY.
 *
 * Phase 7 update: The baseline forecast can now accept a real ForecastResponse
 * from the ML backend (passed in by the simulator page) instead of calling
 * mockForecast() internally. This ensures there is only ONE forecast source
 * across Forecast, Peak Prevention, and Simulator pages.
 *
 * Strategy:
 *   simulateScenario(locality, interventions, baseForecast?, baseSeries?)
 *   - If baseForecast + baseSeries are provided → use real ML baseline
 *   - If not provided → fall back to mockForecast() / mockForecastSeries()
 *
 * The scenario CALCULATION (demand-response formula) remains a prototype.
 * All coefficients live in INTERVENTION_COEFFICIENTS — nothing scattered in components.
 * This is NOT a physical grid simulation; it is a scenario estimate for hackathon demo.
 *
 * Swap-out plan for when a real simulation backend exists:
 *   simulateScenario(locality, interventions) → POST /api/simulate
 * (same return shape as SimulationResult minus `isDemoData`) — unchanged call sites.
 */

import type { Locality } from "@/types/locality";
import { RISK_THRESHOLDS, type RiskLevel } from "@/lib/risk";
import { mockForecast, mockForecastSeries } from "@/lib/forecast";
import type { ForecastResponse, ForecastSeries } from "@/types/forecast";
import type {
  InterventionBreakdownItem,
  InterventionSettings,
  ScenarioSeriesPoint,
  SimulationResult,
} from "@/types/simulator";

export const DEMO_DATA_NOTICE = "Prototype / demo scenario estimate — not a real grid simulation.";

const FORECAST_HORIZON = "1h" as const;

/**
 * Fraction of the baseline peak each intervention removes AT ITS MAXIMUM
 * slider value. Cooling/commercial/flexible sliders max out at 0.5 (50%);
 * solar maxes out at 1.0 (100%) but is additionally capped by the
 * locality's real `solar_capacity_mw` so it never claims more offset than
 * the locality's actual installed capacity.
 */
export const INTERVENTION_COEFFICIENTS = {
  coolingShift: 0.24,    // slider 0.5 → 12% of baseline peak
  commercialShift: 0.2,  // slider 0.5 → 10% of baseline peak
  flexibleLoad: 0.16,    // slider 0.5 →  8% of baseline peak
} as const;

function riskFromRatio(ratio: number): RiskLevel {
  if (ratio < RISK_THRESHOLDS.LOW) return "LOW";
  if (ratio < RISK_THRESHOLDS.MEDIUM) return "MEDIUM";
  if (ratio < RISK_THRESHOLDS.HIGH) return "HIGH";
  return "CRITICAL";
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function simulateScenario(
  locality: Locality,
  interventions: InterventionSettings,
  baseForecast?: ForecastResponse,
  baseSeries?: ForecastSeries,
): SimulationResult {
  // Use real ML baseline if provided; otherwise fall back to mocks
  const forecast = baseForecast ?? mockForecast(locality, FORECAST_HORIZON);
  const series = baseSeries ?? mockForecastSeries(locality, FORECAST_HORIZON);

  const { peakAnalysis, summary } = forecast;

  const baselinePeakMw = peakAnalysis.predictedPeakMw;
  const thresholdMw = peakAnalysis.thresholdMw;

  const coolingReductionMw =
    interventions.coolingShift * INTERVENTION_COEFFICIENTS.coolingShift * baselinePeakMw;
  const commercialReductionMw =
    interventions.commercialShift * INTERVENTION_COEFFICIENTS.commercialShift * baselinePeakMw;
  const flexibleReductionMw =
    interventions.flexibleLoad * INTERVENTION_COEFFICIENTS.flexibleLoad * baselinePeakMw;
  const solarReductionMw = interventions.solarUtilization * locality.solar_capacity_mw;

  const breakdown: InterventionBreakdownItem[] = [
    { key: "coolingShift", label: "Cooling shift", reductionMw: round1(coolingReductionMw) },
    { key: "commercialShift", label: "Commercial shift", reductionMw: round1(commercialReductionMw) },
    { key: "flexibleLoad", label: "Flexible load", reductionMw: round1(flexibleReductionMw) },
    { key: "solarUtilization", label: "Solar utilization", reductionMw: round1(solarReductionMw) },
  ];

  const reductionMw = round1(breakdown.reduce((sum, item) => sum + item.reductionMw, 0));
  const reductionPct = baselinePeakMw > 0 ? round1((reductionMw / baselinePeakMw) * 100) : 0;
  const scenarioPeakMw = round1(Math.max(0, baselinePeakMw - reductionMw));

  const scenarioRisk = riskFromRatio(scenarioPeakMw / thresholdMw);
  const peakAvoided = scenarioPeakMw < thresholdMw;

  // Interventions flatten the peak but, in this prototype model, don't
  // shift when it occurs — only the baseline forecast determines timing.
  const scenarioPeakTime = summary.peakTime;

  const scenarioSeries: ScenarioSeriesPoint[] = series.points.map((point) => {
    const isFuture = point.predictedMw !== null;
    const simulatedMw =
      isFuture && point.predictedMw !== null
        ? round1(
            Math.max(
              0,
              point.predictedMw - (point.predictedMw / baselinePeakMw) * reductionMw,
            ),
          )
        : null;
    return {
      // Convert number timestamp to string to satisfy ScenarioSeriesPoint type.
      // The chart uses `time` (HH:MM) for the X-axis; timestamp is metadata only.
      timestamp: String(point.timestamp),
      time: point.time,
      baselineMw: point.actualMw ?? point.predictedMw,
      simulatedMw: isFuture ? simulatedMw : (point.actualMw ?? null),
    };
  });

  return {
    localityId: locality.id,
    baseline: {
      peakMw: baselinePeakMw,
      peakTime: summary.peakTime,
      thresholdMw,
      risk: peakAnalysis.risk,
    },
    scenario: {
      peakMw: scenarioPeakMw,
      peakTime: scenarioPeakTime,
      risk: scenarioRisk,
      peakAvoided,
    },
    reductionMw,
    reductionPct,
    breakdown,
    series: scenarioSeries,
    isDemoData: true,
  };
}
