/**
 * Mock forecast data adapter — PROTOTYPE / DEMO DATA ONLY.
 *
 * There is no ML forecasting backend yet. This module fabricates a
 * plausible-looking forecast curve, accuracy metrics, model inputs, and an
 * "AI insight" string, all deterministically seeded per locality + horizon
 * so the UI is stable across re-renders.
 *
 * Real values already available from the backend (current demand, peak
 * threshold, risk level) are read straight from the `Locality` passed in —
 * never re-invented — so this stays a single source of truth for anything
 * that already exists.
 *
 * Swap-out plan for when the ML backend exists:
 *   mockForecast(locality, horizon)       -> GET /api/forecast?locality=&horizon=
 *   mockForecastSeries(locality, horizon) -> GET /api/forecast/series?locality=&horizon=
 *   mockModelAccuracy(locality)           -> GET /api/model-metrics?locality=
 * Each function's return type already matches the target response shape
 * (see src/types/forecast.ts), so components call these functions today
 * and a real `fetch` wrapper tomorrow — no component changes required.
 */

import type { Locality, DemandProfile } from "@/types/locality";
import { demandRatio, riskLevel } from "@/lib/risk";
import { createRng } from "@/lib/prng";
import type {
  AccuracyMetric,
  AIInsight,
  ForecastHorizon,
  ForecastInputs,
  ForecastPoint,
  ForecastResponse,
  ForecastSeries,
  ForecastSummary,
  ModelAccuracy,
  PeakAnalysis,
} from "@/types/forecast";

export const DEMO_DATA_NOTICE =
  "Prototype / demo data — generated locally, not a live model output.";

const HORIZON_CONFIG: Record<
  ForecastHorizon,
  { stepMinutes: number; pastSteps: number; futureSteps: number }
> = {
  "15m": { stepMinutes: 15, pastSteps: 12, futureSteps: 12 },
  "1h": { stepMinutes: 60, pastSteps: 6, futureSteps: 18 },
  "24h": { stepMinutes: 60, pastSteps: 24, futureSteps: 24 },
};

function circularDistanceHours(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}

function gaussianBump(hour: number, center: number, widthHours: number): number {
  const d = circularDistanceHours(hour, center);
  return Math.exp(-(d * d) / (2 * widthHours * widthHours));
}

/** 0..1 intensity multiplier for a given hour-of-day, shaped by the locality's demand profile. */
function profileIntensity(hour: number, profile: DemandProfile, peakHour: number): number {
  switch (profile) {
    case "commercial_daytime_peak":
      return 0.4 + 0.6 * gaussianBump(hour, peakHour, 3);
    case "residential_evening_peak":
      return 0.42 + 0.58 * gaussianBump(hour, peakHour, 2.5);
    case "mixed_dual_peak": {
      const primary = gaussianBump(hour, peakHour, 2.2);
      const secondary = gaussianBump(hour, (peakHour + 18) % 24, 2.2);
      return 0.4 + 0.6 * Math.max(primary, secondary * 0.75);
    }
    case "industrial_flat":
    default:
      return 0.78 + 0.12 * gaussianBump(hour, peakHour, 5);
  }
}

function demandCeilingMw(locality: Locality): number {
  const ratio = demandRatio(locality);
  const factor = 0.85 + ratio * 0.3;
  return Math.max(locality.current_demand_mw, locality.peak_threshold_mw) * factor;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDay(date: Date): string {
  return date.toLocaleDateString([], { weekday: "long" });
}

export function mockForecastSeries(locality: Locality, horizon: ForecastHorizon): ForecastSeries {
  const config = HORIZON_CONFIG[horizon];
  const rng = createRng(`${locality.id}:${horizon}:series`);
  const now = new Date();
  const stepMs = config.stepMinutes * 60_000;
  const ceiling = demandCeilingMw(locality);
  const floor = ceiling * 0.55;

  const points: ForecastPoint[] = [];
  const totalSteps = config.pastSteps + config.futureSteps;

  for (let i = -config.pastSteps; i <= config.futureSteps; i++) {
    const timestamp = now.getTime() + i * stepMs;
    const date = new Date(timestamp);
    const hour = date.getHours() + date.getMinutes() / 60;
    const intensity = profileIntensity(hour, locality.demand_profile, locality.typical_peak_hour);
    const noise = 1 + (rng() - 0.5) * 0.05;
    const baseValue = (floor + intensity * (ceiling - floor)) * noise;

    const isPast = i <= 0;
    const stepsAhead = Math.max(0, i);
    const bandFrac = Math.min(0.2, 0.02 + stepsAhead * (0.16 / Math.max(1, totalSteps)));

    points.push({
      timestamp,
      time: formatTime(date),
      actualMw: isPast ? Math.round(baseValue * 10) / 10 : null,
      predictedMw: i >= 0 ? Math.round(baseValue * 10) / 10 : null,
      lowerMw: i >= 0 ? Math.round(baseValue * (1 - bandFrac) * 10) / 10 : null,
      upperMw: i >= 0 ? Math.round(baseValue * (1 + bandFrac) * 10) / 10 : null,
    });
  }

  const futurePoints = points.filter((p) => p.predictedMw !== null && p.timestamp >= now.getTime());
  const peakPoint = futurePoints.reduce(
    (best, p) => (p.predictedMw! > (best?.predictedMw ?? -Infinity) ? p : best),
    futurePoints[0] ?? points[points.length - 1],
  );

  return {
    localityId: locality.id,
    horizon,
    points,
    thresholdMw: locality.peak_threshold_mw,
    peakTimestamp: peakPoint.timestamp,
    peakMw: peakPoint.predictedMw ?? peakPoint.actualMw ?? 0,
  };
}

function peakProbabilityFromRatio(ratio: number): number {
  const pct = (ratio - 0.5) * 130;
  return Math.round(Math.min(99, Math.max(3, pct)));
}

export function mockForecast(locality: Locality, horizon: ForecastHorizon): ForecastResponse {
  const series = mockForecastSeries(locality, horizon);
  const rng = createRng(`${locality.id}:${horizon}:summary`);
  const now = new Date();

  const peakDate = new Date(series.peakTimestamp);
  const windowStart = new Date(series.peakTimestamp - 45 * 60_000);
  const windowEnd = new Date(series.peakTimestamp + 30 * 60_000);
  const peakRatio = series.peakMw / series.thresholdMw;

  const summary: ForecastSummary = {
    localityId: locality.id,
    horizon,
    currentLoadMw: locality.current_demand_mw,
    currentLoadChangePct: Math.round((rng() * 10 - 6) * 10) / 10,
    predictedPeakMw: series.peakMw,
    predictedPeakWindow: { start: formatTime(windowStart), end: formatTime(windowEnd) },
    peakTime: formatTime(peakDate),
    peakProbabilityPct: peakProbabilityFromRatio(peakRatio),
  };

  const peakAnalysis: PeakAnalysis = {
    predictedPeakMw: series.peakMw,
    thresholdMw: series.thresholdMw,
    exceedanceMw: Math.round((series.peakMw - series.thresholdMw) * 10) / 10,
    peakTime: summary.peakTime,
    risk: riskLevel(locality),
    peakProbabilityPct: summary.peakProbabilityPct,
  };

  const solarPeakFactor = Math.max(0, gaussianBump(now.getHours(), 13, 3.5));
  const inputs: ForecastInputs = {
    features: [
      {
        feature: "temperature_c",
        label: "Ambient temperature",
        value: Math.round(28 + rng() * 9),
        unit: "°C",
        source: "fixed_assumption",
        source_note: "Mock value — backend offline. Real values come from GET /api/forecast/inputs.",
      },
      {
        feature: "relative_humidity_percent",
        label: "Relative humidity",
        value: 78.0,
        unit: "%",
        source: "fixed_assumption",
        source_note: "Mock value — backend offline.",
      },
      {
        feature: "lag_1",
        label: "Previous demand (lag-1)",
        value: Math.round(locality.current_demand_mw * (0.88 + rng() * 0.15) * 10) / 10,
        unit: "MW",
        source: "fixed_assumption",
        source_note: "Mock value — backend offline.",
      },
      {
        feature: "solar_irradiance",
        label: "Solar irradiance",
        value: Math.round(locality.solar_capacity_mw * solarPeakFactor * 100) / 100,
        unit: "W/m²",
        source: "fixed_assumption",
        source_note: "Mock value — backend offline.",
      },
    ],
    peakHour: now.getHours(),
    disclaimer: "Mock fallback values — backend offline. Not real model inputs.",
  };

  const drivers: string[] = [];
  if (locality.commercial_share >= 0.4) drivers.push("Commercial load");
  if (locality.cooling_sensitivity >= 0.6) drivers.push("Cooling demand");
  if (locality.typical_peak_hour >= 17 && locality.typical_peak_hour <= 21) {
    drivers.push("Evening demand ramp");
  }
  if (locality.solar_capacity_mw > 0) drivers.push("Solar decline");
  if (drivers.length === 0) drivers.push("Baseline residential demand");

  const uniqueDrivers = Array.from(new Set(drivers)).slice(0, 4);
  const driverPhrase =
    uniqueDrivers.length > 1
      ? `${uniqueDrivers.slice(0, -1).join(", ").toLowerCase()} and ${uniqueDrivers[uniqueDrivers.length - 1].toLowerCase()}`
      : (uniqueDrivers[0] ?? "demand").toLowerCase();

  const insight: AIInsight = {
    summary: `${
      peakAnalysis.risk === "HIGH" || peakAnalysis.risk === "CRITICAL"
        ? "Peak risk is elevated"
        : "Demand is trending toward its typical peak"
    } for ${locality.name} around ${summary.peakTime}, driven mainly by ${driverPhrase}.`,
    drivers: uniqueDrivers,
  };

  return {
    localityId: locality.id,
    horizon,
    summary,
    peakAnalysis,
    inputs,
    insight,
    isDemoData: true,
  };
}

function seededAccuracyMetric(seed: string, base: AccuracyMetric): AccuracyMetric {
  const rng = createRng(seed);
  const jitter = (v: number, spread: number) => Math.round((v + (rng() - 0.5) * spread) * 10) / 10;
  return {
    maeMw: Math.max(0.1, jitter(base.maeMw, base.maeMw * 0.3)),
    rmseMw: Math.max(0.1, jitter(base.rmseMw, base.rmseMw * 0.3)),
    mapePct: Math.max(0.1, jitter(base.mapePct, base.mapePct * 0.25)),
  };
}

export function mockModelAccuracy(locality: Locality): ModelAccuracy {
  return {
    "15m": seededAccuracyMetric(`${locality.id}:acc:15m`, { maeMw: 2.1, rmseMw: 3.4, mapePct: 4.2 }),
    "1h": seededAccuracyMetric(`${locality.id}:acc:1h`, { maeMw: 4.6, rmseMw: 6.8, mapePct: 6.5 }),
    "24h": seededAccuracyMetric(`${locality.id}:acc:24h`, { maeMw: 8.2, rmseMw: 11.5, mapePct: 9.8 }),
  };
}
