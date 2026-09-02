"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Topbar from "@/components/Topbar";
import ForecastHeader from "@/components/forecast/ForecastHeader";
import ForecastControls from "@/components/forecast/ForecastControls";
import ForecastSummaryCards from "@/components/forecast/ForecastSummaryCards";
import ForecastChart from "@/components/forecast/ForecastChart";
import PeakAnalysis from "@/components/forecast/PeakAnalysis";
import ForecastInputsPanel from "@/components/forecast/ForecastInputs";
import AIInsight, { type ExplanationStatus } from "@/components/forecast/AIInsight";
import ModelAccuracy from "@/components/forecast/ModelAccuracy";
import PeakRiskScore from "@/components/forecast/PeakRiskScore";
import {
  fetchLocalities,
  fetchForecast,
  fetchForecastSeries,
  fetchModelAccuracy,
  fetchExplanation,
  fetchForecastInputs,
} from "@/lib/api";
import {
  mockForecast,
  mockForecastSeries,
  mockModelAccuracy,
} from "@/lib/forecast";
import type { Locality } from "@/types/locality";
import type {
  ExplanationData,
  ForecastHorizon,
  ForecastInputs,
  ForecastResponse,
  ForecastSeries,
  ModelAccuracy as ModelAccuracyData,
} from "@/types/forecast";

type BackendStatus = "checking" | "live" | "fallback";
type LoadState = "loading" | "ready" | "error";

export default function ForecastPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [listState, setListState] = useState<LoadState>("loading");
  const [selectedLocalityId, setSelectedLocalityId] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<ForecastHorizon>("1h");

  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [series, setSeries] = useState<ForecastSeries | null>(null);
  const [accuracy, setAccuracy] = useState<ModelAccuracyData | null>(null);
  const [forecastInputs, setForecastInputs] = useState<ForecastInputs | null>(null);
  const [inputsIsDemoFallback, setInputsIsDemoFallback] = useState<boolean>(false);
  const [forecastState, setForecastState] = useState<LoadState>("loading");

  // Explanation state (independent from forecast so it can load in parallel)
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

  // ── SHAP Explanation (fetched independently, same locality+horizon) ─────────
  const loadExplanation = useCallback(async (localityId: string, h: ForecastHorizon) => {
    setExplanationStatus("checking");
    setExplanation(null);
    try {
      const result = await fetchExplanation(localityId, h);
      setExplanation(result.data);
      setExplanationStatus(result.isDemoFallback ? "fallback" : "live");
    } catch {
      setExplanationStatus("fallback");
    }
  }, []);

  // ── Forecast data (real ML backend → fallback to mocks) ───────────────────
  const loadForecast = useCallback(async () => {
    if (!selectedLocality) return;

    setForecastState("loading");
    setBackendStatus("checking");

    try {
      const [forecastResult, seriesResult, accuracyResult, inputsResult] = await Promise.all([
        fetchForecast(selectedLocality.id, horizon),
        fetchForecastSeries(selectedLocality.id, horizon, selectedLocality.peak_threshold_mw),
        fetchModelAccuracy(),
        fetchForecastInputs(selectedLocality.id, horizon),
      ]);

      setForecast(forecastResult.data);
      setSeries(seriesResult.data);
      setAccuracy(accuracyResult.data);
      setForecastInputs(inputsResult.data);
      setInputsIsDemoFallback(inputsResult.isDemoFallback);
      setBackendStatus(forecastResult.isDemoFallback ? "fallback" : "live");
      setForecastState("ready");
    } catch {
      // Backend unreachable — use mock fallback
      setBackendStatus("fallback");
      setForecast(mockForecast(selectedLocality, horizon));
      setSeries(mockForecastSeries(selectedLocality, horizon));
      setAccuracy(mockModelAccuracy(selectedLocality));
      setForecastInputs(null);
      setInputsIsDemoFallback(true);
      setForecastState("ready");
    }
  }, [selectedLocality, horizon]);

  useEffect(() => {
    if (selectedLocality) {
      void loadForecast();
      void loadExplanation(selectedLocality.id, horizon);
    }
  }, [loadForecast, loadExplanation, selectedLocality, horizon]);

  const isLive = backendStatus === "live";

  return (
    <>
      <Topbar title="Forecast" />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        <ForecastHeader />

        {/* Backend status banner */}
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            backendStatus === "live"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : backendStatus === "fallback"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
              : "border-slate-700/40 bg-slate-800/40 text-slate-500"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {backendStatus === "live" && (
              <>
                <span className="font-semibold text-emerald-300">● LIVE MODEL</span>
                {" — "}Forecast values are real XGBoost model outputs for Mumbai demand.
                Peak threshold and locality data come from the backend API.
                SHAP explanations are computed from the same model.
              </>
            )}
            {backendStatus === "fallback" && (
              <>
                <span className="font-semibold text-amber-300">⚠ DEMO FALLBACK</span>
                {" — "}Backend could not be reached. Chart curves, accuracy metrics,
                and peak analysis are local prototype data, not real model output.
              </>
            )}
            {backendStatus === "checking" && (
              "Connecting to ML backend…"
            )}
          </p>
          {backendStatus === "fallback" && (
            <button
              type="button"
              onClick={() => void loadForecast()}
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

        {listState === "ready" && selectedLocality && (
          <>
            <ForecastControls
              localities={localities}
              selectedLocalityId={selectedLocality.id}
              onSelectLocality={setSelectedLocalityId}
              horizon={horizon}
              onSelectHorizon={setHorizon}
            />

            {forecastState === "loading" && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-sm text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading forecast…
              </div>
            )}

            {forecastState === "error" && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center">
                <p className="text-sm font-medium text-red-400">Forecast unavailable</p>
                <button
                  type="button"
                  onClick={() => void loadForecast()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            )}

            {forecastState === "ready" && forecast && series && accuracy && (
              <>
                <ForecastSummaryCards
                  summary={forecast.summary}
                  isLive={isLive}
                />

                <ForecastChart series={series} isLive={isLive} />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="flex flex-col gap-4">
                    <PeakRiskScore analysis={forecast.peakAnalysis} isLive={isLive} />
                    <PeakAnalysis analysis={forecast.peakAnalysis} isLive={isLive} />
                  </div>
                  <div className="lg:col-span-2">
                    {forecastInputs ? (
                      <ForecastInputsPanel
                        inputs={forecastInputs}
                        isDemoFallback={inputsIsDemoFallback}
                      />
                    ) : (
                      <ForecastInputsPanel
                        inputs={{ features: [], peakHour: 0, disclaimer: "" }}
                        isDemoFallback={true}
                      />
                    )}
                  </div>
                </div>

                <AIInsight
                  insight={forecast.insight}
                  explanation={explanation}
                  explanationStatus={explanationStatus}
                  onRetryExplanation={() => {
                    if (selectedLocality) {
                      void loadExplanation(selectedLocality.id, horizon);
                    }
                  }}
                />

                <ModelAccuracy accuracy={accuracy} isLive={isLive} />
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
