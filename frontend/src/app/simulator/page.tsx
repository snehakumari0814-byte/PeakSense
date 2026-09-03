"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import Topbar from "@/components/Topbar";
import SimulatorHeader from "@/components/simulator/SimulatorHeader";
import BaselinePeak from "@/components/simulator/BaselinePeak";
import InterventionControls from "@/components/simulator/InterventionControls";
import ScenarioChart from "@/components/simulator/ScenarioChart";
import ScenarioResult from "@/components/simulator/ScenarioResult";
import InterventionSummary from "@/components/simulator/InterventionSummary";
import DateUnavailablePanel from "@/components/DateUnavailablePanel";
import {
  ApiError,
  fetchLocalities,
  fetchForecast,
  fetchForecastSeries,
  fetchForecastAvailability,
  postSimulate,
} from "@/lib/api";
import { simulateScenario } from "@/lib/simulator";
import { DEFAULT_INTERVENTIONS, type InterventionSettings } from "@/types/simulator";
import type { SimulationResult } from "@/types/simulator";
import { getTodayDate, isValidDateString, type DateAvailability, type DateString } from "@/lib/date";
import { useQuerySync } from "@/lib/useQuerySync";
import type { Locality } from "@/types/locality";
import type { ForecastResponse, ForecastSeries } from "@/types/forecast";

type BackendStatus = "checking" | "live" | "fallback";
type SimulationStatus = "idle" | "running" | "live" | "fallback" | "error";

function SimulatorPageInner() {
  const { initialLocality, initialDate, setParams } = useQuerySync();

  const [localities, setLocalities] = useState<Locality[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedLocalityId, setSelectedLocalityIdState] = useState<string | null>(initialLocality);
  const [selectedDate, setSelectedDateState] = useState<DateString>(
    isValidDateString(initialDate) ? initialDate : getTodayDate(),
  );
  const [availability, setAvailability] = useState<DateAvailability | null>(null);
  const [dateUnavailableDetail, setDateUnavailableDetail] = useState<string | null>(null);

  const [pendingSettings, setPendingSettings] = useState<InterventionSettings>(DEFAULT_INTERVENTIONS);
  const [appliedSettings, setAppliedSettings] = useState<InterventionSettings>(DEFAULT_INTERVENTIONS);
  const [isCalculating, setIsCalculating] = useState(false);

  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [baseForecast, setBaseForecast] = useState<ForecastResponse | undefined>(undefined);
  const [baseSeries, setBaseSeries] = useState<ForecastSeries | undefined>(undefined);

  // Simulation result state
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>("idle");

  // Track the latest run to discard stale responses (avoid race conditions)
  const runIdRef = useRef(0);
  const baselineRunIdRef = useRef(0);

  function setSelectedDate(date: DateString) {
    setSelectedDateState(date);
  }

  // Keep the URL in sync (proactively, not just on user-driven changes) so
  // Peak Prevention → Simulator navigation always carries the current
  // selection, and so it's preserved on refresh.
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

  // ── Fetch real baseline from ML backend ────────────────────────────────────
  const loadBaseline = useCallback(async () => {
    if (!selectedLocality) return;
    const thisRun = ++baselineRunIdRef.current;

    setBackendStatus("checking");
    setDateUnavailableDetail(null);
    try {
      const [forecastResult, seriesResult] = await Promise.all([
        fetchForecast(selectedLocality.id, "1h", selectedDate),
        fetchForecastSeries(selectedLocality.id, "1h", selectedLocality.peak_threshold_mw, selectedDate),
      ]);
      if (thisRun !== baselineRunIdRef.current) return;
      setBaseForecast(forecastResult.data);
      setBaseSeries(seriesResult.data);
      setBackendStatus(forecastResult.isDemoFallback ? "fallback" : "live");
    } catch (err) {
      if (thisRun !== baselineRunIdRef.current) return;
      if (err instanceof ApiError && err.status === 404 && err.detail) {
        setDateUnavailableDetail(err.detail);
        setBaseForecast(undefined);
        setBaseSeries(undefined);
        setBackendStatus("live");
        return;
      }
      setBaseForecast(undefined);
      setBaseSeries(undefined);
      setBackendStatus("fallback");
    }
  }, [selectedLocality, selectedDate]);

  useEffect(() => {
    if (selectedLocality) {
      void loadBaseline();
    }
  }, [loadBaseline, selectedLocality]);

  const dateUnavailable = dateUnavailableDetail !== null;

  // ── Run simulation via POST /api/simulate, fall back to local math ─────────
  const runSimulation = useCallback(async (
    locality: Locality,
    interventions: InterventionSettings,
    forecast: ForecastResponse | undefined,
    series: ForecastSeries | undefined,
    isBackendLive: boolean,
  ) => {
    const thisRun = ++runIdRef.current;
    setSimulationStatus("running");
    setIsCalculating(true);

    // If backend is live, try POST /api/simulate
    if (isBackendLive) {
      try {
        // postSimulate does NOT need baseSeries — the backend generates scenario_series
        const result = await postSimulate(locality.id, "1h", interventions, selectedDate);
        if (thisRun !== runIdRef.current) return; // stale — discard
        setSimulationResult(result.data);
        setSimulationStatus("live");
        setIsCalculating(false);
        return;
      } catch {
        // Backend simulation failed — fall through to local fallback
      }
    }

    // Local mock fallback (always available)
    if (thisRun !== runIdRef.current) return;
    const fallback = simulateScenario(locality, interventions, forecast, series);
    setSimulationResult(fallback);
    setSimulationStatus(isBackendLive ? "fallback" : "fallback");
    setIsCalculating(false);
  }, [selectedDate]);

  // ── Auto-run zero-intervention baseline when locality/backend loads ────────
  useEffect(() => {
    if (selectedLocality && backendStatus !== "checking" && !dateUnavailable) {
      void runSimulation(
        selectedLocality,
        appliedSettings,
        baseForecast,
        baseSeries,
        backendStatus === "live",
      );
    }
    // Only re-run when locality or backend status changes, not when appliedSettings changes
    // (that is handled by handleRun)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocality, backendStatus, baseForecast, baseSeries, dateUnavailable]);

  const isDirty = useMemo(
    () => JSON.stringify(pendingSettings) !== JSON.stringify(appliedSettings),
    [pendingSettings, appliedSettings],
  );

  // ── Event handlers ─────────────────────────────────────────────────────────
  function handleSliderChange(key: keyof InterventionSettings, valuePct: number) {
    setPendingSettings((prev) => ({ ...prev, [key]: valuePct / 100 }));
  }

  function handleRun() {
    if (!selectedLocality) return;
    setAppliedSettings(pendingSettings);
    void runSimulation(
      selectedLocality,
      pendingSettings,
      baseForecast,
      baseSeries,
      backendStatus === "live",
    );
  }

  function handleReset() {
    setPendingSettings(DEFAULT_INTERVENTIONS);
    setAppliedSettings(DEFAULT_INTERVENTIONS);
    if (selectedLocality) {
      void runSimulation(
        selectedLocality,
        DEFAULT_INTERVENTIONS,
        baseForecast,
        baseSeries,
        backendStatus === "live",
      );
    }
  }

  function handleSelectLocality(id: string) {
    setSelectedLocalityIdState(id);
    setPendingSettings(DEFAULT_INTERVENTIONS);
    setAppliedSettings(DEFAULT_INTERVENTIONS);
    setSimulationResult(null);
    setSimulationStatus("idle");
    setDateUnavailableDetail(null);
  }

  function handleRetrySimulation() {
    if (!selectedLocality) return;
    void runSimulation(
      selectedLocality,
      appliedSettings,
      baseForecast,
      baseSeries,
      backendStatus === "live",
    );
  }

  const displayResult = dateUnavailable ? null : simulationResult;
  const needsRetry = simulationStatus === "fallback" || simulationStatus === "error" || backendStatus === "fallback";

  return (
    <>
      <Topbar title="What-If Simulator" variant="light" />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto bg-ps-background p-6">
        <div className="flex items-start justify-between gap-4">
          {selectedLocality ? (
            <SimulatorHeader
              localities={localities}
              selectedLocalityId={selectedLocality.id}
              onSelectLocality={handleSelectLocality}
              selectedDate={selectedDate}
              availability={availability}
              onSelectDate={setSelectedDate}
            />
          ) : (
            <div>
              <h1 className="text-xl font-semibold text-ps-text-primary">What-if simulator</h1>
              <p className="mt-1 text-sm text-ps-text-secondary">
                Test demand-response interventions before the predicted peak
              </p>
            </div>
          )}

          {needsRetry && (
            <button
              type="button"
              onClick={backendStatus === "fallback" ? () => void loadBaseline() : handleRetrySimulation}
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

        {listState === "ready" && dateUnavailable && (
          <DateUnavailablePanel
            requestedDate={selectedDate}
            detail={dateUnavailableDetail ?? undefined}
            onUseToday={() => setSelectedDate(getTodayDate())}
          />
        )}

        {listState === "ready" && !dateUnavailable && (
          <>
            {/* Baseline section — always show from baseForecast if available */}
            {displayResult && (
              <BaselinePeak baseline={displayResult.baseline} isLive={!displayResult.isDemoData} />
            )}
            {!displayResult && backendStatus === "checking" && (
              <div className="flex items-center gap-2 rounded-xl border border-ps-border bg-ps-card p-8 text-sm text-ps-text-muted shadow-sm">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading baseline forecast…
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <InterventionControls
                  settings={pendingSettings}
                  onChange={handleSliderChange}
                  onRun={handleRun}
                  onReset={handleReset}
                  isCalculating={isCalculating}
                  isDirty={isDirty}
                />
              </div>
              <div className="lg:col-span-2">
                {isCalculating ? (
                  <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-ps-border bg-ps-card shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-ps-text-muted">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {backendStatus === "live" ? "Running simulation…" : "Calculating…"}
                    </div>
                  </div>
                ) : displayResult ? (
                  <ScenarioResult result={displayResult} />
                ) : null}
              </div>
            </div>

            {displayResult && (
              <>
                <ScenarioChart result={displayResult} />
                <InterventionSummary
                  breakdown={displayResult.breakdown}
                  totalReductionMw={displayResult.reductionMw}
                  isDemoData={displayResult.isDemoData}
                />
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}

export default function SimulatorPage() {
  return (
    <Suspense fallback={null}>
      <SimulatorPageInner />
    </Suspense>
  );
}
