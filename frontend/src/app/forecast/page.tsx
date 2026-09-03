"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
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
import DateUnavailablePanel from "@/components/DateUnavailablePanel";
import {
  ApiError,
  fetchLocalities,
  fetchForecast,
  fetchForecastSeries,
  fetchForecastAvailability,
  fetchModelAccuracy,
  fetchExplanation,
  fetchForecastInputs,
} from "@/lib/api";
import {
  mockForecast,
  mockForecastSeries,
  mockModelAccuracy,
} from "@/lib/forecast";
import { getTodayDate, isValidDateString, type DateAvailability, type DateString } from "@/lib/date";
import { useQuerySync } from "@/lib/useQuerySync";
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

function ForecastPageInner() {
  const { initialLocality, initialDate, setParams } = useQuerySync();

  const [localities, setLocalities] = useState<Locality[]>([]);
  const [listState, setListState] = useState<LoadState>("loading");
  const [selectedLocalityId, setSelectedLocalityIdState] = useState<string | null>(initialLocality);
  const [horizon, setHorizon] = useState<ForecastHorizon>("1h");
  const [selectedDate, setSelectedDateState] = useState<DateString>(
    isValidDateString(initialDate) ? initialDate : getTodayDate(),
  );
  const [availability, setAvailability] = useState<DateAvailability | null>(null);

  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [series, setSeries] = useState<ForecastSeries | null>(null);
  const [accuracy, setAccuracy] = useState<ModelAccuracyData | null>(null);
  const [forecastInputs, setForecastInputs] = useState<ForecastInputs | null>(null);
  const [inputsIsDemoFallback, setInputsIsDemoFallback] = useState<boolean>(false);
  const [forecastState, setForecastState] = useState<LoadState>("loading");
  const [dateUnavailableDetail, setDateUnavailableDetail] = useState<string | null>(null);

  // Explanation state (independent from forecast so it can load in parallel)
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [explanationStatus, setExplanationStatus] = useState<ExplanationStatus>("checking");

  // Discard stale responses when locality/horizon change rapidly.
  const runIdRef = useRef(0);

  function setSelectedLocalityId(id: string) {
    setSelectedLocalityIdState(id);
  }

  function setSelectedDate(date: DateString) {
    setSelectedDateState(date);
  }

  // Keep the URL's `locality`/`date` params in sync with current state —
  // proactively (not just on user-driven changes) so a Sidebar nav click
  // to another page always carries the current selection forward.
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
        // Respect a locality already chosen via URL (e.g. arriving from
        // another page); otherwise default to the first locality.
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
      .catch(() => {
        // Leave availability null — the calendar shows "checking…" and
        // per-request 404s still surface honestly via DateUnavailablePanel.
      });
    return () => { cancelled = true; };
  }, []);

  // ── SHAP Explanation (fetched independently, same locality+horizon+date) ───
  const loadExplanation = useCallback(async (localityId: string, h: ForecastHorizon, date: DateString) => {
    setExplanationStatus("checking");
    setExplanation(null);
    try {
      const result = await fetchExplanation(localityId, h, date);
      setExplanation(result.data);
      setExplanationStatus(result.isDemoFallback ? "fallback" : "live");
    } catch {
      setExplanationStatus("fallback");
    }
  }, []);

  // ── Forecast data (real ML backend → fallback to mocks) ───────────────────
  const loadForecast = useCallback(async () => {
    if (!selectedLocality) return;
    const thisRun = ++runIdRef.current;

    setForecastState("loading");
    setBackendStatus("checking");
    setDateUnavailableDetail(null);

    try {
      const [forecastResult, seriesResult, accuracyResult, inputsResult] = await Promise.all([
        fetchForecast(selectedLocality.id, horizon, selectedDate),
        fetchForecastSeries(selectedLocality.id, horizon, selectedLocality.peak_threshold_mw, selectedDate),
        fetchModelAccuracy(),
        fetchForecastInputs(selectedLocality.id, horizon, selectedDate),
      ]);
      if (thisRun !== runIdRef.current) return; // a newer request superseded this one

      setForecast(forecastResult.data);
      setSeries(seriesResult.data);
      setAccuracy(accuracyResult.data);
      setForecastInputs(inputsResult.data);
      setInputsIsDemoFallback(inputsResult.isDemoFallback);
      setBackendStatus(forecastResult.isDemoFallback ? "fallback" : "live");
      setForecastState("ready");
    } catch (err) {
      if (thisRun !== runIdRef.current) return;
      if (err instanceof ApiError && err.status === 404 && err.detail) {
        // A genuine, honest "this date can't be served" response from the
        // backend — not a connectivity failure, so no mock fallback.
        setDateUnavailableDetail(err.detail);
        setBackendStatus("live");
        setForecastState("ready");
        return;
      }
      // Backend unreachable — use mock fallback
      setBackendStatus("fallback");
      setForecast(mockForecast(selectedLocality, horizon));
      const mockSeries = mockForecastSeries(selectedLocality, horizon);
      setSeries(mockSeries);
      setAccuracy(mockModelAccuracy(selectedLocality));
      setForecastInputs(null);
      setInputsIsDemoFallback(true);
      setForecastState("ready");
    }
  }, [selectedLocality, horizon, selectedDate]);

  useEffect(() => {
    if (selectedLocality) {
      void loadForecast();
      void loadExplanation(selectedLocality.id, horizon, selectedDate);
    }
  }, [loadForecast, loadExplanation, selectedLocality, horizon, selectedDate]);

  const isLive = backendStatus === "live";
  const dateUnavailable = dateUnavailableDetail !== null;

  return (
    <>
      <Topbar title="Forecast" variant="light" />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto bg-ps-background p-6">
        <div className="flex items-start justify-between gap-4">
          <ForecastHeader />
          {backendStatus === "fallback" && (
            <button
              type="button"
              onClick={() => void loadForecast()}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-ps-border bg-ps-card px-2.5 py-1.5 text-xs font-medium text-ps-text-secondary shadow-sm hover:text-ps-text-primary"
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

        {listState === "ready" && selectedLocality && (
          <>
            <ForecastControls
              localities={localities}
              selectedLocalityId={selectedLocality.id}
              onSelectLocality={setSelectedLocalityId}
              horizon={horizon}
              onSelectHorizon={setHorizon}
              selectedDate={selectedDate}
              availability={availability}
              onSelectDate={setSelectedDate}
            />

            {forecastState === "loading" && (
              <div className="flex items-center gap-2 rounded-xl border border-ps-border bg-ps-card p-8 text-sm text-ps-text-muted shadow-sm">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading forecast…
              </div>
            )}

            {forecastState === "error" && (
              <div className="rounded-xl border border-ps-critical bg-ps-critical-soft p-6 text-center">
                <p className="text-sm font-medium text-ps-critical">Forecast unavailable</p>
                <button
                  type="button"
                  onClick={() => void loadForecast()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-ps-border bg-ps-card px-4 py-2 text-xs font-medium text-ps-text-secondary shadow-sm hover:text-ps-text-primary"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            )}

            {forecastState === "ready" && dateUnavailable && (
              <DateUnavailablePanel
                requestedDate={selectedDate}
                detail={dateUnavailableDetail ?? undefined}
                onUseToday={() => setSelectedDate(getTodayDate())}
              />
            )}

            {forecastState === "ready" && !dateUnavailable && forecast && series && accuracy && (
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
                      void loadExplanation(selectedLocality.id, horizon, selectedDate);
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

export default function ForecastPage() {
  return (
    <Suspense fallback={null}>
      <ForecastPageInner />
    </Suspense>
  );
}
