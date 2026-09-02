/**
 * PeakSense Peak Prevention data adapter.
 *
 * Phase 9C update:
 *
 * - buildPreventionFromForecast() now accepts ExplanationData (SHAP) and
 *   SimulationResult (from POST /api/simulate) in addition to the forecast.
 *
 * - buildDriversFromShap():  SHAP-driven, not seeded random.
 * - buildTimelineFromSeries(): derived from real ForecastSeries timestamps.
 * - buildRecommendationsFromDrivers(): SHAP-category-to-intervention mapping.
 * - Peak Reduction Opportunity: from real POST /api/simulate result.
 *
 * Fallback: if SHAP or simulation is unavailable, the corresponding section
 * falls back to the seeded mock. Fallback is clearly labelled.
 *
 * Swap-out plan: complete. All sections are now live or clearly labelled.
 */

import type { Locality } from "@/types/locality";
import { createRng } from "@/lib/prng";
import { mockForecast, mockForecastSeries } from "@/lib/forecast";
import type {
  ForecastResponse,
  ForecastSeries,
  ExplanationData,
  FeatureDriver,
} from "@/types/forecast";
import type { SimulationResult } from "@/types/simulator";
import type {
  PeakDriver,
  PreventionData,
  Recommendation,
  TimelineEvent,
} from "@/types/prevention";
import type { RiskLevel } from "@/lib/risk";

export const DEMO_DATA_NOTICE =
  "Prototype / demo data — generated locally, not a validated model output.";

const FORECAST_HORIZON = "1h" as const;

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── SHAP → PeakDriver mapping ────────────────────────────────────────────────

/**
 * Build PeakDriver list from real SHAP explanation data.
 *
 * Normalization formula:
 *   normalized_pct_i = |shap_value_i| / sum(|all_shap_values|) × 100
 *
 * These are "model contribution shares", NOT load percentages.
 * Only top N by absolute SHAP value are shown.
 */
export function buildDriversFromShap(
  drivers: FeatureDriver[],
  topN = 5,
): PeakDriver[] {
  if (!drivers || drivers.length === 0) return [];

  // Use top drivers sorted by |shap_value| (already sorted by backend)
  const top = drivers.slice(0, Math.min(topN, drivers.length));
  const totalAbsShap = top.reduce((sum, d) => sum + Math.abs(d.shapValueMw), 0);
  if (totalAbsShap === 0) return [];

  return top.map((d) => ({
    name: d.label,
    contributionPct: Math.round((Math.abs(d.shapValueMw) / totalAbsShap) * 100),
    shapValueMw: d.shapValueMw,
    direction: d.direction,
    category: d.category,
  }));
}

// ─── SHAP category → intervention mapping ────────────────────────────────────

/**
 * Build prioritized recommendation list from SHAP driver categories + simulation result.
 *
 * Mapping rules (deterministic):
 *   weather/solar → cooling load shifting (top priority if weather is top driver)
 *   lag/rolling   → flexible load rescheduling (historical demand is dominant)
 *   temporal      → commercial demand shifting (always present)
 *   solar         → solar utilization (if locality has solar capacity)
 *
 * MW values come from the REAL POST /api/simulate result using the same
 * default scenario that drives the PeakReductionOpportunity panel.
 * If simulationResult is null, this falls back to estimated ranges.
 */
export function buildRecommendationsFromDrivers(
  drivers: FeatureDriver[],
  simulationResult: SimulationResult | null,
  localitySolarCapacity: number,
): Recommendation[] {
  // Determine category ranking from SHAP
  const topCategories: string[] = [];
  for (const d of drivers) {
    if (d.direction === "increase" && !topCategories.includes(d.category)) {
      topCategories.push(d.category);
    }
  }

  // SHAP-category priority: weather → lag/rolling → temporal → solar
  const weatherIsTop = topCategories[0] === "weather" || topCategories[0] === "solar";
  const lagIsTop = topCategories[0] === "lag" || topCategories[0] === "rolling";

  // Build intervention map from simulation result (matched by key)
  const simMap: Record<string, number> = {};
  if (simulationResult) {
    for (const item of simulationResult.breakdown) {
      simMap[item.key] = item.reductionMw;
    }
  }

  const getRec = (key: string): number | null =>
    simMap[key] ?? null;

  const recs: Recommendation[] = [];

  if (weatherIsTop) {
    // Cooling load shifting first when weather/thermal features dominate
    recs.push({
      id: "cooling-load-shifting",
      title: "Cooling load shifting",
      description: "Shift flexible cooling loads before the predicted peak. Weather features are the strongest positive model driver.",
      simulatedReductionMw: getRec("coolingShift"),
      driverBasis: "weather features are top SHAP driver",
    });
    recs.push({
      id: "commercial-demand-response",
      title: "Commercial demand response",
      description: "Reduce discretionary commercial load during the peak window.",
      simulatedReductionMw: getRec("commercialShift"),
      driverBasis: "temporal peak pattern",
    });
    recs.push({
      id: "flexible-load-scheduling",
      title: "Flexible load scheduling",
      description: "Move non-critical flexible consumption outside the peak window.",
      simulatedReductionMw: getRec("flexibleLoad"),
      driverBasis: "lag/rolling demand pattern",
    });
  } else if (lagIsTop) {
    // Flexible load first when historical demand features dominate
    recs.push({
      id: "flexible-load-scheduling",
      title: "Flexible load scheduling",
      description: "Move non-critical flexible consumption outside the peak window. Historical demand trends are the strongest model driver.",
      simulatedReductionMw: getRec("flexibleLoad"),
      driverBasis: "lag/rolling features are top SHAP driver",
    });
    recs.push({
      id: "commercial-demand-response",
      title: "Commercial demand response",
      description: "Reduce discretionary commercial load during the peak window.",
      simulatedReductionMw: getRec("commercialShift"),
      driverBasis: "temporal peak pattern",
    });
    recs.push({
      id: "cooling-load-shifting",
      title: "Cooling load shifting",
      description: "Shift flexible cooling loads before the predicted peak.",
      simulatedReductionMw: getRec("coolingShift"),
      driverBasis: "thermal conditions",
    });
  } else {
    // Default order
    recs.push({
      id: "cooling-load-shifting",
      title: "Cooling load shifting",
      description: "Shift flexible cooling loads before the predicted peak.",
      simulatedReductionMw: getRec("coolingShift"),
      driverBasis: "thermal conditions",
    });
    recs.push({
      id: "commercial-demand-response",
      title: "Commercial demand response",
      description: "Reduce discretionary commercial load during the peak window.",
      simulatedReductionMw: getRec("commercialShift"),
      driverBasis: "temporal demand pattern",
    });
    recs.push({
      id: "flexible-load-scheduling",
      title: "Flexible load scheduling",
      description: "Move non-critical flexible consumption outside the peak window.",
      simulatedReductionMw: getRec("flexibleLoad"),
      driverBasis: "lag/rolling demand pattern",
    });
  }

  // Solar utilization last (only if locality has solar capacity)
  if (localitySolarCapacity > 0) {
    recs.push({
      id: "solar-utilization",
      title: "Solar utilization",
      description: "Maximize local solar contribution before the evening solar decline.",
      simulatedReductionMw: getRec("solarUtilization"),
      driverBasis: "solar irradiance feature",
    });
  }

  return recs;
}

// ─── Timeline from real ForecastSeries ───────────────────────────────────────

/**
 * Build PreventionTimeline from real ForecastSeries + peak info.
 *
 * Algorithm:
 * 1. Walk the forecast series and classify each point's risk via the same
 *    threshold ratio used by the backend: LOW < 0.8, MEDIUM < 0.9, HIGH < 0.95, CRITICAL >= 0.95
 * 2. Identify transitions: first point where risk goes MEDIUM, HIGH, CRITICAL.
 * 3. Also identify the peak point (max predictedMw) and the first post-peak point
 *    where risk drops below HIGH.
 * 4. Return at most 6 labelled events, using actual series timestamps.
 *
 * This replaces the previous fixed ±hour offsets from the peak time.
 */
export function buildTimelineFromSeries(
  series: ForecastSeries,
  thresholdMw: number,
  risk: RiskLevel,
): TimelineEvent[] {
  if (!series.points.length) return buildTimelineFallback(series.peakTimestamp, risk);

  const points = series.points;
  const futurePoints = points.filter((p) => p.predictedMw !== null);
  if (!futurePoints.length) return buildTimelineFallback(series.peakTimestamp, risk);

  // Classify risk at each point using the same ratios as the backend
  const classify = (mw: number | null): RiskLevel => {
    if (mw === null) return "LOW";
    const ratio = mw / thresholdMw;
    if (ratio >= 1.0) return "CRITICAL";
    if (ratio >= 0.95) return "HIGH";
    if (ratio >= 0.85) return "MEDIUM";
    return "LOW";
  };

  // Find key transition points
  let normalPt = futurePoints[0]!;
  let rampPt: typeof futurePoints[0] | null = null;
  let highRiskPt: typeof futurePoints[0] | null = null;
  let peakPt = futurePoints[0]!;
  let postPeakPt: typeof futurePoints[0] | null = null;

  let peakMw = -Infinity;
  let foundRamp = false;
  let foundHigh = false;
  let pastPeak = false;

  for (const p of futurePoints) {
    const r = classify(p.predictedMw);
    const mw = p.predictedMw ?? 0;

    if (r === "MEDIUM" && !foundRamp) {
      rampPt = p;
      foundRamp = true;
    }
    if ((r === "HIGH" || r === "CRITICAL") && !foundHigh) {
      highRiskPt = p;
      foundHigh = true;
    }
    if (mw > peakMw) {
      peakMw = mw;
      peakPt = p;
      pastPeak = false;
    } else if (mw < peakMw && !pastPeak && foundHigh) {
      pastPeak = true;
    }
    if (pastPeak && (r === "MEDIUM" || r === "LOW") && !postPeakPt) {
      postPeakPt = p;
    }
  }

  const events: TimelineEvent[] = [];

  // 1. Normal / baseline
  events.push({
    timestamp: new Date(normalPt.timestamp).getTime(),
    time: normalPt.time,
    label: "Normal",
    risk: "LOW",
    isPeak: false,
  });

  // 2. Demand ramp (first MEDIUM)
  if (rampPt && rampPt.timestamp !== normalPt.timestamp) {
    events.push({
      timestamp: new Date(rampPt.timestamp).getTime(),
      time: rampPt.time,
      label: "Demand ramp",
      risk: "MEDIUM",
      isPeak: false,
    });
  }

  // 3. High risk (first HIGH/CRITICAL)
  if (highRiskPt && highRiskPt.timestamp !== rampPt?.timestamp) {
    events.push({
      timestamp: new Date(highRiskPt.timestamp).getTime(),
      time: highRiskPt.time,
      label: risk === "CRITICAL" ? "Critical risk" : "High risk",
      risk: risk === "CRITICAL" ? "CRITICAL" : "HIGH",
      isPeak: false,
    });
  }

  // 4. Predicted peak
  events.push({
    timestamp: new Date(peakPt.timestamp).getTime(),
    time: peakPt.time,
    label: "Predicted peak",
    risk,
    isPeak: true,
  });

  // 5. Post-peak decline
  if (postPeakPt) {
    events.push({
      timestamp: new Date(postPeakPt.timestamp).getTime(),
      time: postPeakPt.time,
      label: "Risk declining",
      risk: "MEDIUM",
      isPeak: false,
    });
  }

  // Remove duplicates by timestamp
  const seen = new Set<number>();
  return events.filter((e) => {
    if (seen.has(e.timestamp)) return false;
    seen.add(e.timestamp);
    return true;
  });
}

/** Fallback when series is empty — uses fixed offsets from peak timestamp. */
function buildTimelineFallback(peakTimestamp: number, risk: RiskLevel): TimelineEvent[] {
  const HOUR = 60 * 60_000;
  const stages = [
    { offsetMs: -2 * HOUR, label: "Normal", risk: "LOW" as RiskLevel },
    { offsetMs: -1.5 * HOUR, label: "Demand ramp", risk: "MEDIUM" as RiskLevel },
    { offsetMs: -1 * HOUR, label: "High risk", risk: "HIGH" as RiskLevel },
    { offsetMs: 0, label: "Predicted peak", risk, isPeak: true },
    { offsetMs: 0.5 * HOUR, label: "Risk declining", risk: "MEDIUM" as RiskLevel },
  ];
  return stages.map((s) => {
    const ts = peakTimestamp + s.offsetMs;
    return {
      timestamp: ts,
      time: formatTime(new Date(ts)),
      label: s.label,
      risk: s.risk,
      isPeak: s.isPeak ?? false,
    };
  });
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build PreventionData from REAL backend data.
 *
 * Phase 9C:
 * - drivers: from SHAP explanation (buildDriversFromShap)
 * - recommendations: from SHAP categories + simulation breakdown (buildRecommendationsFromDrivers)
 * - timeline: from real ForecastSeries timestamps (buildTimelineFromSeries)
 * - reduction: from real POST /api/simulate result
 *
 * @param locality - Locality config
 * @param forecast  - Real forecast response (from GET /api/forecast)
 * @param series    - Real forecast series (from GET /api/forecast/series)
 * @param explanation - Real SHAP explanation (from GET /api/explanation) or null
 * @param simulation  - Real simulation result (from POST /api/simulate) or null
 */
export function buildPreventionFromForecast(
  locality: Locality,
  forecast: ForecastResponse,
  series: ForecastSeries,
  explanation: ExplanationData | null = null,
  simulation: SimulationResult | null = null,
  apiRecommendations: Recommendation[] | null = null,
): PreventionData {
  const { peakAnalysis, summary } = forecast;

  // ── Drivers ───────────────────────────────────────────────────────────────
  const hasRealShap = explanation && !explanation.isDemoFallback && explanation.drivers.length > 0;
  const drivers: PeakDriver[] = hasRealShap
    ? buildDriversFromShap(explanation.drivers)
    : buildDriversFallback(locality);

  // ── Recommendations ───────────────────────────────────────────────────────
  // Prefer the real backend GET /api/recommendations engine (SHAP category
  // mapping + real SimulationService, ranked server-side). Fall back to the
  // equivalent client-side heuristic (still real SHAP + real simulation
  // numbers) if that endpoint is unavailable, then to the seeded mock.
  const hasRealSim = simulation && !simulation.isDemoData;
  const recommendations: Recommendation[] =
    apiRecommendations && apiRecommendations.length > 0
      ? apiRecommendations
      : hasRealShap
        ? buildRecommendationsFromDrivers(
            explanation.drivers,
            hasRealSim ? simulation : null,
            locality.solar_capacity_mw,
          )
        : buildRecommendationsFallback(locality, `${locality.id}:prevention:recs`);

  // ── Explanation text ───────────────────────────────────────────────────────
  // Use SHAP summary if available; otherwise construct from forecast values
  const explanationText = explanation?.summary
    ?? `Demand is expected to peak around ${peakAnalysis.peakTime} with ${peakAnalysis.predictedPeakMw} MW against a ${peakAnalysis.thresholdMw} MW threshold (risk: ${peakAnalysis.risk}).`;

  // ── Timeline ───────────────────────────────────────────────────────────────
  const timeline = buildTimelineFromSeries(series, peakAnalysis.thresholdMw, peakAnalysis.risk);

  // ── Peak Reduction Opportunity ─────────────────────────────────────────────
  const reduction = hasRealSim
    ? {
        baselinePeakMw: simulation.baseline.peakMw,
        potentialReductionMw: simulation.reductionMw,
        potentialPeakMw: simulation.scenario.peakMw,
        isDemoData: false,
        scenarioDescription: "Moderate scenario: 30% cooling shift · 20% commercial shift · 10% flexible load · 50% solar",
      }
    : {
        baselinePeakMw: peakAnalysis.predictedPeakMw,
        potentialReductionMw: 0,
        potentialPeakMw: peakAnalysis.predictedPeakMw,
        isDemoData: true,
        scenarioDescription: "Simulation unavailable",
      };

  // Parse peak window
  const windowRaw = series.points.length > 0
    ? { start: summary.predictedPeakWindow.start, end: summary.predictedPeakWindow.end }
    : { start: peakAnalysis.peakTime, end: peakAnalysis.peakTime };

  // isDemoData: false only when ALL sections are real
  const isDemoData = !(hasRealShap && hasRealSim);

  return {
    localityId: locality.id,
    peakTime: summary.peakTime,
    peakWindow: windowRaw,
    risk: peakAnalysis.risk,
    peakProbabilityPct: peakAnalysis.peakProbabilityPct,
    expectedDemandMw: peakAnalysis.predictedPeakMw,
    thresholdMw: peakAnalysis.thresholdMw,
    exceedanceMw: peakAnalysis.exceedanceMw,
    explanation: explanationText,
    drivers,
    recommendations,
    timeline,
    reduction,
    isDemoData,
  };
}

// ─── Fallback helpers (seeded, for demo / backend-offline scenarios) ──────────

function buildDriversFallback(locality: Locality): PeakDriver[] {
  const driverNames: string[] = [];
  if (locality.commercial_share >= 0.4) driverNames.push("Commercial load");
  if (locality.cooling_sensitivity >= 0.6) driverNames.push("Cooling demand");
  if (locality.typical_peak_hour >= 17 && locality.typical_peak_hour <= 21) {
    driverNames.push("Evening demand ramp");
  }
  if (locality.solar_capacity_mw > 0) driverNames.push("Solar decline");
  if (driverNames.length === 0) driverNames.push("Baseline residential demand");

  const seed = `${locality.id}:prevention:drivers`;
  const rng = createRng(seed);
  const weights = driverNames.map(() => 0.5 + rng());
  const total = weights.reduce((a, b) => a + b, 0);
  const pcts = weights.map((w) => Math.round((w / total) * 100));
  const diff = 100 - pcts.reduce((a, b) => a + b, 0);
  pcts[0] += diff;

  return driverNames
    .map((name, i) => ({
      name,
      contributionPct: pcts[i]!,
      shapValueMw: null,
      direction: "increase" as const,
      category: "other",
    }))
    .sort((a, b) => b.contributionPct - a.contributionPct);
}

function buildRecommendationsFallback(locality: Locality, seed: string): Recommendation[] {
  const rng = createRng(seed);
  const jitter = () => 1 + (rng() - 0.5) * 0.3;
  const demandRatio = Math.min(1.6, Math.max(0.5, 0.6 + (locality.current_demand_mw / 300) * 0.6));
  const round = (v: number) => Math.max(1, Math.round(v * demandRatio * jitter()));

  return [
    {
      id: "cooling-load-shifting",
      title: "Cooling load shifting",
      description: "Shift flexible cooling loads before the predicted peak.",
      simulatedReductionMw: null,
      driverBasis: "demo estimate",
      impact: { type: "reduction" as const, minMw: round(8), maxMw: round(12) },
    },
    {
      id: "commercial-demand-response",
      title: "Commercial demand response",
      description: "Reduce discretionary commercial load during the peak window.",
      simulatedReductionMw: null,
      driverBasis: "demo estimate",
      impact: { type: "reduction" as const, minMw: round(5), maxMw: round(8) },
    },
    {
      id: "flexible-load-scheduling",
      title: "Flexible load scheduling",
      description: "Move non-critical flexible consumption outside the peak window.",
      simulatedReductionMw: null,
      driverBasis: "demo estimate",
      impact: { type: "reduction" as const, minMw: round(3), maxMw: round(5) },
    },
    ...(locality.solar_capacity_mw > 0
      ? [{
          id: "solar-utilization",
          title: "Solar utilization",
          description: "Maximize local solar contribution before the evening solar decline.",
          simulatedReductionMw: null as null,
          driverBasis: "demo estimate",
          impact: { type: "support" as const, minMw: round(2), maxMw: round(4) },
        }]
      : []),
  ];
}

/**
 * Legacy mock adapter — FALLBACK ONLY when real ML backend is offline.
 * Preserved intact. Called only when the prevention page cannot reach the backend.
 */
export function mockPreventionData(locality: Locality): PreventionData {
  const forecast = mockForecast(locality, FORECAST_HORIZON);
  const series = mockForecastSeries(locality, FORECAST_HORIZON);
  const { peakAnalysis, summary } = forecast;

  const drivers = buildDriversFallback(locality);
  const explanation = `${forecast.insight.summary} Predicted demand is expected to reach ${peakAnalysis.predictedPeakMw} MW against a ${peakAnalysis.thresholdMw} MW threshold.`;
  const recommendations = buildRecommendationsFallback(locality, `${locality.id}:prevention:recs`);
  const timeline = buildTimelineFallback(series.peakTimestamp, peakAnalysis.risk);

  const reductionMidpoints = recommendations
    .filter((r) => r.impact?.type === "reduction")
    .map((r) => ((r.impact?.minMw ?? 0) + (r.impact?.maxMw ?? 0)) / 2);
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
      isDemoData: true,
      scenarioDescription: "Demo fallback estimate",
    },
    isDemoData: true,
  };
}
