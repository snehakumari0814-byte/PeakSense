"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import Topbar from "@/components/Topbar";
import PreventionHeader from "@/components/prevention/PreventionHeader";
import PeakRiskOverview from "@/components/prevention/PeakRiskOverview";
import AIExplanation, { type ExplanationStatus } from "@/components/prevention/AIExplanation";
import PeakDrivers from "@/components/prevention/PeakDrivers";
import MitigationRecommendations from "@/components/prevention/MitigationRecommendations";
import PreventionTimeline from "@/components/prevention/PreventionTimeline";
import PeakReductionOpportunity from "@/components/prevention/PeakReductionOpportunity";
import DateUnavailablePanel from "@/components/DateUnavailablePanel";
import {
  ApiError,
  fetchLocalities,
  fetchForecast,
  fetchForecastSeries,
  fetchForecastAvailability,
  fetchExplanation,
  fetchRecommendations,
  postSimulate,
} from "@/lib/api";
import {
  buildPreventionFromForecast,
  mockPreventionData,
} from "@/lib/prevention";
import { getTodayDate, isValidDateString, type DateAvailability, type DateString } from "@/lib/date";
import { useQuerySync } from "@/lib/useQuerySync";
import type { Locality } from "@/types/locality";
import type { ExplanationData } from "@/types/forecast";
import type { PreventionData, Recommendation } from "@/types/prevention";
import type { SimulationResult } from "@/types/simulator";

type BackendStatus = "checking" | "live" | "fallback";

/**
 * Default "moderate scenario" used for Peak Reduction Opportunity.
 * These same values power POST /api/simulate, so numbers are consistent
 * with the What-If Simulator when these interventions are selected.
 *
 * cooling_shift=0.30 | commercial_shift=0.20 | flexible_load=0.10 | solar_utilization=0.50
 */
const DEFAULT_PREVENTION_INTERVENTIONS = {
  coolingShift: 0.30,
  commercialShift: 0.20,
  flexibleLoad: 0.10,
  solarUtilization: 0.50,
} as const;

function PeakPreventionPageInner() {
  const { initialLocality, initialDate, setParams } = useQuerySync();

  const [localities, setLocalities] = useState<Locality[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedLocalityId, setSelectedLocalityIdState] = useState<string | null>(initialLocality);
  const [selectedDate, setSelectedDateState] = useState<DateString>(
    isValidDateString(initialDate) ? initialDate : getTodayDate(),
  );
  const [availability, setAvailability] = useState<DateAvailability | null>(null);
  const [dateUnavailableDetail, setDateUnavailableDetail] = useState<string | null>(null);

  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [prevention, setPrevention] = useState<PreventionData | null>(null);
  const [preventionState, setPreventionState] = useState<"loading" | "ready" | "error">("loading");

  // Explanation state — same endpoint as Forecast page
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [explanationStatus, setExplanationStatus] = useState<ExplanationStatus>("checking");

  const runIdRef = useRef(0);

  function setSelectedLocalityId(id: string) {
    setSelectedLocalityIdState(id);
  }
  function setSelectedDate(date: DateString) {
    setSelectedDateState(date);
  }

  // Keep the URL in sync so navigating away and back (or to Forecast /
  // Simulator) preserves this exact selection.
  useEffect(() => {
    if (selectedLocalityId) {
      setParams({ locality: selectedLocalityId, date: selectedDate });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocalityId, selectedDate]);

  // ── Locality list ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    fetchLocalities()
      .then((data) => {
        if (cancelled) return;
        setLocalities(data);
        setListState("ready");
        const valid = initialLocality && data.some((l) => l.id === initialLocality);
        if (!selectedLocalityId || !data.some((l) => l.id === selectedLocalityId)) {
          setSelectedLocalityIdState(valid ? initialLocality! : data[0]?.id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setListState("error");
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedLocality = useMemo(
    () => localities.find((l) => l.id === selectedLocalityId) ?? null,
    [localities, selectedLocalityId],
  );

  // ── Date availability (fetched once — the genuine backend-derived range) ───
  useEffect(() => {
    let cancelled = false;
    fetchForecastAvailability()
      .then((data) => {
        if (!cancelled) setAvailability(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── SHAP Explanation (same source as Forecast page) ───────────────────────
  const loadExplanation = useCallback(async (localityId: string, date: DateString) => {
    setExplanationStatus("checking");
    setExplanation(null);
    try {
      const result = await fetchExplanation(localityId, "1h", date);
      setExplanation(result.data);
      setExplanationStatus(result.isDemoFallback ? "fallback" : "live");
    } catch {
      setExplanationStatus("fallback");
    }
  }, []);

  // ── Prevention data (real forecast + SHAP + simulation → fallback to mocks) ─
  const loadPrevention = useCallback(async () => {
    if (!selectedLocality) return;
    const thisRun = ++runIdRef.current;

    setPreventionState("loading");
    setBackendStatus("checking");
    setDateUnavailableDetail(null);

    try {
      // Step 1: Fetch forecast + series in parallel
      const [forecastResult, seriesResult] = await Promise.all([
        fetchForecast(selectedLocality.id, "1h", selectedDate),
        fetchForecastSeries(selectedLocality.id, "1h", selectedLocality.peak_threshold_mw, selectedDate),
      ]);
      if (thisRun !== runIdRef.current) return;

      // Step 2: Fetch SHAP explanation + default scenario simulation +
      // backend recommendations in parallel. These are independent of each
      // other and can fail independently.
      let explanationData: ExplanationData | null = null;
      let simulationData: SimulationResult | null = null;
      let recommendationsData: Recommendation[] | null = null;

      const [explResult, simResult, recResult] = await Promise.allSettled([
        fetchExplanation(selectedLocality.id, "1h", selectedDate),
        postSimulate(selectedLocality.id, "1h", DEFAULT_PREVENTION_INTERVENTIONS, selectedDate),
        fetchRecommendations(selectedLocality.id, "1h", selectedDate),
      ]);
      if (thisRun !== runIdRef.current) return;

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

      if (recResult.status === "fulfilled" && !recResult.value.isDemoFallback) {
        recommendationsData = recResult.value.data;
      }

      // Step 3: Build prevention data from all real sources
      const data = buildPreventionFromForecast(
        selectedLocality,
        forecastResult.data,
        seriesResult.data,
        explanationData,
        simulationData,
        recommendationsData,
      );

      setPrevention(data);
      setBackendStatus(forecastResult.isDemoFallback ? "fallback" : "live");
      setPreventionState("ready");
    } catch (err) {
      if (thisRun !== runIdRef.current) return;
      if (err instanceof ApiError && err.status === 404 && err.detail) {
        setDateUnavailableDetail(err.detail);
        setBackendStatus("live");
        setPreventionState("ready");
        return;
      }
      setBackendStatus("fallback");
      const fallback = mockPreventionData(selectedLocality);
      setPrevention(fallback);
      setPreventionState("ready");
    }
  }, [selectedLocality, selectedDate]);

  useEffect(() => {
    if (selectedLocality) {
      void loadPrevention();
    }
  }, [loadPrevention, selectedLocality]);

  const isLive = backendStatus === "live";
  const dateUnavailable = dateUnavailableDetail !== null;

  const driversAreShap = prevention
    ? !prevention.isDemoData && prevention.drivers.some((d) => d.shapValueMw !== null)
    : false;

  const simulatorHref = selectedLocality
    ? `/simulator?locality=${encodeURIComponent(selectedLocality.id)}&date=${encodeURIComponent(selectedDate)}`
    : "/simulator";

  return (
    <>
      <Topbar title="Peak Prevention" variant="light" />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto bg-ps-background p-6">
        <div className="flex items-start justify-between gap-4">
          {selectedLocality && prevention ? (
            <PreventionHeader
              localities={localities}
              selectedLocalityId={selectedLocality.id}
              onSelectLocality={setSelectedLocalityId}
              peakTime={prevention.peakTime}
              risk={prevention.risk}
              selectedDate={selectedDate}
              availability={availability}
              onSelectDate={setSelectedDate}
            />
          ) : (
            <div>
              <h1 className="text-xl font-semibold text-ps-text-primary">Peak prevention</h1>
              <p className="mt-1 text-sm text-ps-text-secondary">
                Identify actions to reduce predicted grid stress
              </p>
            </div>
          )}

          {backendStatus === "fallback" && (
            <button
              type="button"
              onClick={() => void loadPrevention()}
              className="mt-1 flex shrink-0 items-center gap-1.5 rounded-md border border-ps-border bg-ps-card px-2.5 py-1.5 text-xs font-medium text-ps-text-secondary shadow-sm hover:text-ps-text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          )}
        </div>

        {listState === "loading" && (
          <p className="text-sm text-ps-text-muted">Loading locality data…</p>
        )}

        {listState === "error" && (
          <p className="text-sm text-ps-critical">
            Could not reach the backend at the configured API URL. Make sure the FastAPI server
            is running.
          </p>
        )}

        {preventionState === "loading" && listState === "ready" && (
          <div className="flex items-center gap-2 rounded-xl border border-ps-border bg-ps-card p-8 text-sm text-ps-text-muted shadow-sm">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading forecast data…
          </div>
        )}

        {listState === "ready" && preventionState === "ready" && dateUnavailable && (
          <DateUnavailablePanel
            requestedDate={selectedDate}
            detail={dateUnavailableDetail ?? undefined}
            onUseToday={() => setSelectedDate(getTodayDate())}
          />
        )}

        {listState === "ready" && preventionState === "ready" && prevention && !dateUnavailable && (
          <>
            <PeakRiskOverview data={prevention} isLive={isLive} />

            {/* SHAP explanation — same source as Forecast page */}
            <AIExplanation
              explanation={explanation}
              explanationStatus={explanationStatus}
              demoExplanationText={prevention.explanation}
              onRetry={() => selectedLocality && void loadExplanation(selectedLocality.id, selectedDate)}
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
                href={simulatorHref}
                className="flex items-center gap-2 rounded-md border border-ps-border bg-ps-card px-5 py-2.5 text-sm font-medium text-ps-accent shadow-sm transition-colors hover:bg-ps-accent-soft"
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

export default function PeakPreventionPage() {
  return (
    <Suspense fallback={null}>
      <PeakPreventionPageInner />
    </Suspense>
  );
}
