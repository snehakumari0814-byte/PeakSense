/**
 * Mock Peak Prevention data adapter — PROTOTYPE / DEMO DATA ONLY.
 *
 * This deliberately reuses `mockForecast()` / `mockForecastSeries()` from
 * `lib/forecast.ts` for the peak time/demand/threshold/risk numbers, so the
 * Peak Prevention page never maintains a second, independent forecast
 * dataset — only the prevention-specific content (driver contribution
 * split, explanation text, recommendations, timeline, reduction estimate)
 * is fabricated here, deterministically seeded per locality.
 *
 * Swap-out plan for when the explanation/recommendation backend exists:
 *   mockPreventionData(locality) -> GET /api/explanation + GET /api/recommendations
 * (merged client-side, or combined into one endpoint) — same return shape,
 * so components keep working unchanged.
 */

import type { Locality } from "@/types/locality";
import { demandRatio } from "@/lib/risk";
import { createRng } from "@/lib/prng";
import { mockForecast, mockForecastSeries } from "@/lib/forecast";
import type {
  PeakDriver,
  PreventionData,
  Recommendation,
  TimelineEvent,
} from "@/types/prevention";

export const DEMO_DATA_NOTICE =
  "Prototype / demo data — generated locally, not a validated model output.";

const FORECAST_HORIZON = "1h" as const;

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function buildDrivers(driverNames: string[], seed: string): PeakDriver[] {
  const names = driverNames.length > 0 ? driverNames : ["Baseline demand"];
  const rng = createRng(seed);
  const weights = names.map(() => 0.5 + rng());
  const total = weights.reduce((a, b) => a + b, 0);
  const pcts = weights.map((w) => Math.round((w / total) * 100));

  const diff = 100 - pcts.reduce((a, b) => a + b, 0);
  pcts[0] += diff;

  return names
    .map((name, i) => ({ name, contributionPct: pcts[i] }))
    .sort((a, b) => b.contributionPct - a.contributionPct);
}

function buildRecommendations(scale: number, seed: string): Recommendation[] {
  const rng = createRng(seed);
  const jitter = () => 1 + (rng() - 0.5) * 0.3;

  const round = (v: number) => Math.max(1, Math.round(v * scale * jitter()));

  return [
    {
      id: "cooling-load-shifting",
      title: "Cooling load shifting",
      description: "Shift flexible cooling loads before the predicted peak.",
      impact: { type: "reduction", minMw: round(8), maxMw: round(12) },
    },
    {
      id: "commercial-demand-response",
      title: "Commercial demand response",
      description: "Reduce discretionary commercial load during the peak window.",
      impact: { type: "reduction", minMw: round(5), maxMw: round(8) },
    },
    {
      id: "flexible-load-scheduling",
      title: "Flexible load scheduling",
      description: "Move non-critical flexible consumption outside the peak window.",
      impact: { type: "reduction", minMw: round(3), maxMw: round(5) },
    },
    {
      id: "solar-utilization",
      title: "Solar utilization",
      description: "Maximize local solar contribution before the evening solar decline.",
      impact: { type: "support", minMw: round(2), maxMw: round(4) },
    },
  ];
}

function buildTimeline(peakTimestamp: number, risk: PreventionData["risk"]): TimelineEvent[] {
  const HOUR = 60 * 60_000;
  const stages: { offsetMs: number; label: string; risk: TimelineEvent["risk"]; isPeak?: boolean }[] = [
    { offsetMs: -2 * HOUR, label: "Normal", risk: "LOW" },
    { offsetMs: -1.5 * HOUR, label: "Demand ramp", risk: "MEDIUM" },
    { offsetMs: -1 * HOUR, label: "High risk", risk: "HIGH" },
    { offsetMs: -0.5 * HOUR, label: "Critical risk", risk: risk === "CRITICAL" ? "CRITICAL" : "HIGH" },
    { offsetMs: 0, label: "Predicted peak", risk, isPeak: true },
    { offsetMs: 0.5 * HOUR, label: "Risk declining", risk: "MEDIUM" },
  ];

  return stages.map((stage) => {
    const timestamp = peakTimestamp + stage.offsetMs;
    return {
      timestamp,
      time: formatTime(new Date(timestamp)),
      label: stage.label,
      risk: stage.risk,
      isPeak: stage.isPeak ?? false,
    };
  });
}

export function mockPreventionData(locality: Locality): PreventionData {
  const forecast = mockForecast(locality, FORECAST_HORIZON);
  const series = mockForecastSeries(locality, FORECAST_HORIZON);
  const { peakAnalysis, summary, insight } = forecast;

  const drivers = buildDrivers(insight.drivers, `${locality.id}:prevention:drivers`);

  const explanation = `${insight.summary} Predicted demand is expected to reach ${peakAnalysis.predictedPeakMw} MW against a ${peakAnalysis.thresholdMw} MW threshold.`;

  const scale = Math.min(1.6, Math.max(0.5, 0.6 + demandRatio(locality) * 0.6));
  const recommendations = buildRecommendations(scale, `${locality.id}:prevention:recs`);

  const timeline = buildTimeline(series.peakTimestamp, peakAnalysis.risk);

  const reductionMidpoints = recommendations
    .filter((r) => r.impact.type === "reduction")
    .map((r) => (r.impact.minMw + r.impact.maxMw) / 2);
  const potentialReductionMw = Math.round(reductionMidpoints.reduce((a, b) => a + b, 0) * 10) / 10;
  const potentialPeakMw = Math.round((peakAnalysis.predictedPeakMw - potentialReductionMw) * 10) / 10;

  return {
    localityId: locality.id,
    peakTime: summary.peakTime,
    peakWindow: summary.predictedPeakWindow,
    risk: peakAnalysis.risk,
    peakProbabilityPct: peakAnalysis.peakProbabilityPct,
    expectedDemandMw: peakAnalysis.predictedPeakMw,
    thresholdMw: peakAnalysis.thresholdMw,
    exceedanceMw: peakAnalysis.exceedanceMw,
    explanation,
    drivers,
    recommendations,
    timeline,
    reduction: {
      baselinePeakMw: peakAnalysis.predictedPeakMw,
      potentialReductionMw,
      potentialPeakMw,
    },
    isDemoData: true,
  };
}
