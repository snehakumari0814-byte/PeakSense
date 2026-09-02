"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Topbar from "@/components/Topbar";
import ForecastHeader from "@/components/forecast/ForecastHeader";
import ForecastControls from "@/components/forecast/ForecastControls";
import ForecastSummaryCards from "@/components/forecast/ForecastSummaryCards";
import ForecastChart from "@/components/forecast/ForecastChart";
import PeakAnalysis from "@/components/forecast/PeakAnalysis";
import ForecastInputs from "@/components/forecast/ForecastInputs";
import AIInsight from "@/components/forecast/AIInsight";
import ModelAccuracy from "@/components/forecast/ModelAccuracy";
import PeakRiskScore from "@/components/forecast/PeakRiskScore";
import { fetchLocalities } from "@/lib/api";
import { mockForecast, mockForecastSeries, mockModelAccuracy } from "@/lib/forecast";
import type { Locality } from "@/types/locality";
import type { ForecastHorizon } from "@/types/forecast";

export default function ForecastPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedLocalityId, setSelectedLocalityId] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<ForecastHorizon>("1h");

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

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedLocality = useMemo(
    () => localities.find((l) => l.id === selectedLocalityId) ?? null,
    [localities, selectedLocalityId],
  );

  const forecast = useMemo(
    () => (selectedLocality ? mockForecast(selectedLocality, horizon) : null),
    [selectedLocality, horizon],
  );
  const series = useMemo(
    () => (selectedLocality ? mockForecastSeries(selectedLocality, horizon) : null),
    [selectedLocality, horizon],
  );
  const accuracy = useMemo(
    () => (selectedLocality ? mockModelAccuracy(selectedLocality) : null),
    [selectedLocality],
  );

  return (
    <>
      <Topbar title="Forecast" />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        <ForecastHeader />

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            This page uses a local mock forecast adapter for the hackathon prototype — chart
            curves, accuracy metrics, and AI insight text are DEMO/SEEDED, not real model output.
            Current demand and peak threshold come from the backend locality API.
          </p>
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

        {listState === "ready" && selectedLocality && forecast && series && accuracy && (
          <>
            <ForecastControls
              localities={localities}
              selectedLocalityId={selectedLocality.id}
              onSelectLocality={setSelectedLocalityId}
              horizon={horizon}
              onSelectHorizon={setHorizon}
            />

            <ForecastSummaryCards summary={forecast.summary} />

            <ForecastChart series={series} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="flex flex-col gap-4">
                <PeakRiskScore analysis={forecast.peakAnalysis} />
                <PeakAnalysis analysis={forecast.peakAnalysis} />
              </div>
              <div className="lg:col-span-2">
                <ForecastInputs inputs={forecast.inputs} />
              </div>
            </div>

            <AIInsight insight={forecast.insight} />

            <ModelAccuracy accuracy={accuracy} />
          </>
        )}
      </main>
    </>
  );
}
