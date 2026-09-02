"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import Topbar from "@/components/Topbar";
import PreventionHeader from "@/components/prevention/PreventionHeader";
import PeakRiskOverview from "@/components/prevention/PeakRiskOverview";
import AIExplanation, { type ExplanationStatus } from "@/components/prevention/AIExplanation";
import PeakDrivers from "@/components/prevention/PeakDrivers";
import MitigationRecommendations from "@/components/prevention/MitigationRecommendations";
import PreventionTimeline from "@/components/prevention/PreventionTimeline";
import PeakReductionOpportunity from "@/components/prevention/PeakReductionOpportunity";
import {
  fetchLocalities,
  fetchForecast,
  fetchForecastSeries,
  fetchExplanation,
  postSimulate,
} from "@/lib/api";
import {
  buildPreventionFromForecast,
  mockPreventionData,
} from "@/lib/prevention";
import type { Locality } from "@/types/locality";
import type { ExplanationData } from "@/types/forecast";
import type { PreventionData } from "@/types/prevention";
import type { SimulationResult } from "@/types/simulator";

type BackendStatus = "checking" | "live" | "fallback";

/**
 * Default "moderate scenario" used for Peak Reduction Opportunity.
 * These same values power POST /api/simulate, so numbers are consistent
 * with the What-If Simulator when these interventions are selected.
 *
 * cooling_shift=0.30 | commercial_shift=0.20 | flexible_load=0.10 | solar_utilization=0.50
 *
 * Labelled "Moderate scenario opportunity" — not optimal or guaranteed.
 */
const DEFAULT_PREVENTION_INTERVENTIONS = {
  coolingShift: 0.30,
  commercialShift: 0.20,
  flexibleLoad: 0.10,
  solarUtilization: 0.50,
} as const;

export default function PeakPreventionPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedLocalityId, setSelectedLocalityId] = useState<string | null>(null);

  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [prevention, setPrevention] = useState<PreventionData | null>(null);
  const [preventionState, setPreventionState] = useState<"loading" | "ready" | "error">("loading");

  // Explanation state — same endpoint as Forecast page
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [explanationStatus, setExplanationStatus] = useState<ExplanationStatus>("checking");

  // ── Locality list ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    fetchLocalities()
      .then((data) => {
        if (cancelled) return;
        setLocalities(data);
        setListState("ready");
        if (data.length > 0) setSelectedLocalityId(data[0].id);
      })
      .catch(() => {
        if (!cancelled) setListState("error");
      });

    return () => { cancelled = true; };
  }, []);

  const selectedLocality = useMemo(
    () => localities.find((l) => l.id === selectedLocalityId) ?? null,
    [localities, selectedLocalityId],
  );

  // ── SHAP Explanation (same source as Forecast page) ───────────────────────
  const loadExplanation = useCallback(async (localityId: string) => {
    setExplanationStatus("checking");
    setExplanation(null);
    try {
      const result = await fetchExplanation(localityId, "1h");
      setExplanation(result.data);
      setExplanationStatus(result.isDemoFallback ? "fallback" : "live");
    } catch {
      setExplanationStatus("fallback");
    }
  }, []);

  // ── Prevention data (real forecast + SHAP + simulation → fallback to mocks) ─
  const loadPrevention = useCallback(async () => {
    if (!selectedLocality) return;

    setPreventionState("loading");
    setBackendStatus("checking");

    try {
      // Step 1: Fetch forecast + series in parallel
      const [forecastResult, seriesResult] = await Promise.all([
        fetchForecast(selectedLocality.id, "1h"),
        fetchForecastSeries(selectedLocality.id, "1h", selectedLocality.peak_threshold_mw),
      ]);

      // Step 2: Fetch SHAP explanation + default scenario simulation in parallel
      // These are independent of each other and can fail independently
      let explanationData: ExplanationData | null = null;
      let simulationData: SimulationResult | null = null;

      const [explResult, simResult] = await Promise.allSettled([
        fetchExplanation(selectedLocality.id, "1h"),
        postSimulate(selectedLocality.id, "1h", DEFAULT_PREVENTION_INTERVENTIONS),
      ]);

      if (explResult.status === "fulfilled") {
        explanationData = explResult.value.data;
        setExplanation(explanationData);
        setExplanationStatus(explResult.value.isDemoFallback ? "fallback" : "live");
      } else {
        setExplanationStatus("fallback");
      }

      if (simResult.status === "fulfilled") {
        simulationData = simResult.value.data;
      }

      // Step 3: Build prevention data from all real sources
      const data = buildPreventionFromForecast(
        selectedLocality,
        forecastResult.data,
        seriesResult.data,
        explanationData,
        simulationData,
      );

      setPrevention(data);
      setBackendStatus(forecastResult.isDemoFallback ? "fallback" : "live");
      setPreventionState("ready");
    } catch {
      setBackendStatus("fallback");
      setPrevention(mockPreventionData(selectedLocality));
      setPreventionState("ready");
    }
  }, [selectedLocality]);

  useEffect(() => {
    if (selectedLocality) {
      void loadPrevention();
    }
  }, [loadPrevention, selectedLocality]);

  const isLive = backendStatus === "live";

  // Determine what is genuinely live for the status banner
  const driversAreShap = prevention
    ? !prevention.isDemoData && prevention.drivers.some((d) => d.shapValueMw !== null)
    : false;
  const reductionIsLive = prevention ? !prevention.reduction.isDemoData : false;

  return (
    <>
      <Topbar title="Peak Prevention" />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        {selectedLocality && prevention ? (
          <PreventionHeader
            localities={localities}
            selectedLocalityId={selectedLocality.id}
            onSelectLocality={setSelectedLocalityId}
            peakTime={prevention.peakTime}
            risk={prevention.risk}
          />
        ) : (
          <div>
            <h1 className="text-xl font-semibold text-white">Peak Prevention</h1>
            <p className="mt-1 text-sm text-slate-500">
              Understand the predicted peak and identify actions to reduce grid stress.
            </p>
          </div>
        )}

        {/* Backend status banner */}
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            isLive
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : backendStatus === "fallback"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
              : "border-slate-700/40 bg-slate-800/40 text-slate-500"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {isLive && (
              <>
                <span className="font-semibold text-emerald-300">● LIVE MODEL</span>
                {" — "}Peak, demand, threshold, risk, and SHAP explanation come from the real ML backend.
                {driversAreShap && " Key Drivers use real SHAP contributions."}
                {reductionIsLive && " Peak Reduction uses real POST /api/simulate."}
                {" "}Timeline derives from real forecast series timestamps.
                {!driversAreShap && " SHAP unavailable — Key Drivers are estimates."}
              </>
            )}
            {backendStatus === "fallback" && (
              <>
                <span className="font-semibold text-amber-300">⚠ DEMO FALLBACK</span>
                {" — "}Backend offline. All values are local prototype data.
              </>
            )}
            {backendStatus === "checking" && "Connecting to ML backend…"}
          </p>
          {backendStatus === "fallback" && (
            <button
              type="button"
              onClick={() => { void loadPrevention(); }}
              className="ml-auto flex shrink-0 items-center gap-1 rounded border border-amber-500/40 px-2 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>

        {listState === "loading" && (
          <p className="text-sm text-slate-500">Loading locality data…</p>
        )}

        {listState === "error" && (
          <p className="text-sm text-red-400">
            Could not reach the backend at the configured API URL. Make sure the FastAPI server
            is running.
          </p>
        )}

        {preventionState === "loading" && listState === "ready" && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading forecast data…
          </div>
        )}

        {listState === "ready" && preventionState === "ready" && prevention && (
          <>
            <PeakRiskOverview data={prevention} />

            {/* SHAP explanation — same source as Forecast page */}
            <AIExplanation
              explanation={explanation}
              explanationStatus={explanationStatus}
              demoExplanationText={prevention.explanation}
              onRetry={() => selectedLocality && void loadExplanation(selectedLocality.id)}
            />

            <PeakDrivers
              drivers={prevention.drivers}
              isDemoData={!driversAreShap}
            />

            <MitigationRecommendations
              recommendations={prevention.recommendations}
              isDemoData={prevention.isDemoData}
            />

            <PreventionTimeline
              timeline={prevention.timeline}
              isDemoData={prevention.isDemoData}
            />

            <PeakReductionOpportunity reduction={prevention.reduction} />

            <div className="flex justify-center py-2">
              <Link
                href="/simulator"
                className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                Open What-If Simulator
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}
      </main>
    </>
  );
}
