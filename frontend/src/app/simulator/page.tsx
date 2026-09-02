"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Topbar from "@/components/Topbar";
import SimulatorHeader from "@/components/simulator/SimulatorHeader";
import BaselinePeak from "@/components/simulator/BaselinePeak";
import InterventionControls from "@/components/simulator/InterventionControls";
import ScenarioChart from "@/components/simulator/ScenarioChart";
import ScenarioResult from "@/components/simulator/ScenarioResult";
import InterventionSummary from "@/components/simulator/InterventionSummary";
import { fetchLocalities, fetchForecast, fetchForecastSeries, postSimulate } from "@/lib/api";
import { simulateScenario } from "@/lib/simulator";
import { DEFAULT_INTERVENTIONS, type InterventionSettings } from "@/types/simulator";
import type { SimulationResult } from "@/types/simulator";
import type { Locality } from "@/types/locality";
import type { ForecastResponse, ForecastSeries } from "@/types/forecast";

type BackendStatus = "checking" | "live" | "fallback";
type SimulationStatus = "idle" | "running" | "live" | "fallback" | "error";

export default function SimulatorPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedLocalityId, setSelectedLocalityId] = useState<string | null>(null);

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

  // ── Fetch real baseline from ML backend ────────────────────────────────────
  const loadBaseline = useCallback(async () => {
    if (!selectedLocality) return;

    setBackendStatus("checking");
    try {
      const [forecastResult, seriesResult] = await Promise.all([
        fetchForecast(selectedLocality.id, "1h"),
        fetchForecastSeries(selectedLocality.id, "1h", selectedLocality.peak_threshold_mw),
      ]);
      setBaseForecast(forecastResult.data);
      setBaseSeries(seriesResult.data);
      setBackendStatus(forecastResult.isDemoFallback ? "fallback" : "live");
    } catch {
      setBaseForecast(undefined);
      setBaseSeries(undefined);
      setBackendStatus("fallback");
    }
  }, [selectedLocality]);

  useEffect(() => {
    if (selectedLocality) {
      void loadBaseline();
    }
  }, [loadBaseline, selectedLocality]);

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
        const result = await postSimulate(locality.id, "1h", interventions);
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
  }, []);

  // ── Auto-run zero-intervention baseline when locality/backend loads ────────
  useEffect(() => {
    if (selectedLocality && backendStatus !== "checking") {
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
  }, [selectedLocality, backendStatus, baseForecast, baseSeries]);

  const isDirty = useMemo(
    () => JSON.stringify(pendingSettings) !== JSON.stringify(appliedSettings),
    [pendingSettings, appliedSettings],
  );

  const isLiveResult = simulationStatus === "live";

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
    setSelectedLocalityId(id);
    setPendingSettings(DEFAULT_INTERVENTIONS);
    setAppliedSettings(DEFAULT_INTERVENTIONS);
    setSimulationResult(null);
    setSimulationStatus("idle");
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

  const displayResult = simulationResult;

  return (
    <>
      <Topbar title="What-If Simulator" />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        {selectedLocality ? (
          <SimulatorHeader
            localities={localities}
            selectedLocalityId={selectedLocality.id}
            onSelectLocality={handleSelectLocality}
          />
        ) : (
          <div>
            <h1 className="text-xl font-semibold text-white">What-If Simulator</h1>
            <p className="mt-1 text-sm text-slate-500">
              Test demand-response interventions before the predicted peak.
            </p>
          </div>
        )}

        {/* Backend / simulation status banner */}
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            isLiveResult
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : simulationStatus === "fallback" || backendStatus === "fallback"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
              : "border-slate-700/40 bg-slate-800/40 text-slate-500"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {isLiveResult && (
              <>
                <span className="font-semibold text-emerald-300">● LIVE MODEL</span>
                {" — "}Baseline and scenario result come from the real ML backend
                (POST /api/simulate). Intervention effects use transparent documented
                demand-response coefficients — not a physical grid simulation.
              </>
            )}
            {simulationStatus === "fallback" && !isLiveResult && (
              <>
                <span className="font-semibold text-amber-300">⚠ DEMO FALLBACK</span>
                {" — "}
                {backendStatus === "live"
                  ? "Backend simulation request failed. Using local prototype calculation."
                  : "Backend offline. Baseline and scenario are prototype estimates only."}
              </>
            )}
            {simulationStatus === "running" && "Running simulation…"}
            {simulationStatus === "idle" && backendStatus === "checking" && "Connecting to ML backend…"}
            {simulationStatus === "error" && (
              <>
                <span className="font-semibold text-red-300">⚠ SIMULATION ERROR</span>
                {" — "}The simulation failed. Click Retry to try again.
              </>
            )}
          </p>
          {(simulationStatus === "fallback" || simulationStatus === "error") && (
            <button
              type="button"
              onClick={handleRetrySimulation}
              className="ml-auto flex shrink-0 items-center gap-1 rounded border border-amber-500/40 px-2 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
          {backendStatus === "fallback" && simulationStatus !== "running" && (
            <button
              type="button"
              onClick={() => void loadBaseline()}
              className="ml-auto flex shrink-0 items-center gap-1 rounded border border-amber-500/40 px-2 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry backend
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

        {listState === "ready" && (
          <>
            {/* Baseline section — always show from baseForecast if available */}
            {displayResult && (
              <BaselinePeak baseline={displayResult.baseline} isLive={!displayResult.isDemoData} />
            )}
            {!displayResult && backendStatus === "checking" && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-sm text-slate-500">
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
                  <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {backendStatus === "live" ? "Running backend simulation…" : "Calculating…"}
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
