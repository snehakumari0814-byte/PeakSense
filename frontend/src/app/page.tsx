"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardKpiGrid, { type DashboardKpiData } from "@/components/dashboard/DashboardKpiGrid";
import DashboardDemandChart from "@/components/dashboard/DashboardDemandChart";
import DashboardLocalityRisk from "@/components/dashboard/DashboardLocalityRisk";
import DashboardAiInsight from "@/components/dashboard/DashboardAiInsight";
import DashboardFooterBanner from "@/components/dashboard/DashboardFooterBanner";
import {
  fetchLocalities,
  fetchForecast,
  fetchForecastSeries,
  fetchExplanation,
} from "@/lib/api";
import {
  mockForecast,
  mockForecastSeries,
} from "@/lib/forecast";
import type { Locality } from "@/types/locality";
import type {
  ExplanationData,
  ForecastPoint,
  ForecastResponse,
  ForecastSeries,
} from "@/types/forecast";

export default function DashboardPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [forecasts, setForecasts] = useState<Record<string, ForecastResponse>>({});
  const [selectedLocalityId, setSelectedLocalityId] = useState<string | "all">("all");
  const [activeSeries, setActiveSeries] = useState<ForecastPoint[] | null>(null);
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // ── Master Data Ingestion ───────────────────────────────────────────────────
  const loadDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch live localities
      const locList = await fetchLocalities();
      setLocalities(locList);

      // 2. Fetch 24h forecasts for all localities in parallel
      const forecastResults = await Promise.allSettled(
        locList.map((loc) => fetchForecast(loc.id, "24h")),
      );

      const forecastMap: Record<string, ForecastResponse> = {};
      let anyLive = false;

      forecastResults.forEach((res, idx) => {
        const loc = locList[idx];
        if (res.status === "fulfilled") {
          forecastMap[loc.id] = res.value.data;
          if (!res.value.isDemoFallback) anyLive = true;
        } else {
          forecastMap[loc.id] = mockForecast(loc, "24h");
        }
      });

      setForecasts(forecastMap);
      setIsOnline(anyLive);
      setLoading(false);
    } catch {
      // Offline fallback
      setIsOnline(false);
      setLoading(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ── Load Series & Explanation based on Selected Scope ─────────────────────
  useEffect(() => {
    if (localities.length === 0) return;

    let cancelled = false;

    async function loadScopeDetails() {
      if (selectedLocalityId === "all") {
        // Aggregate 24h curve from the 10 localities
        try {
          const seriesResults = await Promise.allSettled(
            localities.map((loc) =>
              fetchForecastSeries(loc.id, "24h", loc.peak_threshold_mw),
            ),
          );

          if (cancelled) return;

          const successfulSeries: ForecastSeries[] = seriesResults
            .map((res, i) =>
              res.status === "fulfilled"
                ? res.value.data
                : mockForecastSeries(localities[i], "24h"),
            );

          if (successfulSeries.length > 0 && successfulSeries[0].points.length > 0) {
            const numPoints = successfulSeries[0].points.length;
            const aggPoints: ForecastPoint[] = [];

            for (let pIdx = 0; pIdx < numPoints; pIdx++) {
              const basePoint = successfulSeries[0].points[pIdx];
              let totalPred = 0;
              let totalActual: number | null = 0;

              successfulSeries.forEach((s) => {
                const pt = s.points[pIdx];
                if (pt) {
                  totalPred += pt.predictedMw ?? 0;
                  if (pt.actualMw !== null) {
                    totalActual = (totalActual ?? 0) + pt.actualMw;
                  }
                }
              });

              aggPoints.push({
                timestamp: basePoint.timestamp,
                time: basePoint.time,
                actualMw: totalActual,
                predictedMw: Math.round(totalPred * 10) / 10,
                lowerMw: null,
                upperMw: null,
              });
            }
            setActiveSeries(aggPoints);
          }

          // Fetch explanation for Andheri / city representative
          const explRes = await fetchExplanation(localities[0]?.id ?? "andheri", "24h");
          if (!cancelled) setExplanation(explRes.data);
        } catch {
          if (!cancelled) {
            // Mock fallback series
            const mockS = mockForecastSeries(localities[0], "24h");
            setActiveSeries(mockS.points);
          }
        }
      } else {
        // Individual Locality Scope
        const loc = localities.find((l) => l.id === selectedLocalityId);
        if (!loc) return;

        try {
          const [seriesRes, explRes] = await Promise.all([
            fetchForecastSeries(loc.id, "24h", loc.peak_threshold_mw),
            fetchExplanation(loc.id, "24h"),
          ]);
          if (!cancelled) {
            setActiveSeries(seriesRes.data.points);
            setExplanation(explRes.data);
          }
        } catch {
          if (!cancelled) {
            const mockS = mockForecastSeries(loc, "24h");
            setActiveSeries(mockS.points);
          }
        }
      }
    }

    loadScopeDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedLocalityId, localities]);

  // ── Derived KPI Metrics ───────────────────────────────────────────────────
  const kpiData = useMemo<DashboardKpiData | null>(() => {
    if (localities.length === 0) return null;

    if (selectedLocalityId === "all") {
      // Sum of all 10 prototype localities
      const totalLoad = localities.reduce((acc, l) => acc + l.current_demand_mw, 0);

      // Aggregate peak from forecast map or activeSeries
      let peakMw = 0;
      let peakTime = "13:35";
      let peakWindow = "Today, 12:30 PM – 4:00 PM";
      let maxProb = 99;

      if (activeSeries && activeSeries.length > 0) {
        const peakPt = activeSeries.reduce(
          (max, p) => ((p.predictedMw ?? 0) > (max.predictedMw ?? 0) ? p : max),
          activeSeries[0],
        );
        peakMw = peakPt.predictedMw ?? 0;
        peakTime = peakPt.time;
      } else {
        peakMw = Object.values(forecasts).reduce(
          (acc, f) => acc + (f.peakAnalysis?.predictedPeakMw ?? 0),
          0,
        );
      }

      return {
        currentLoadMw: totalLoad,
        currentLoadSubtitle: "Prototype locality aggregate (10 zones)",
        predictedPeakMw: peakMw > 0 ? peakMw : totalLoad * 1.35,
        predictedPeakWindow: peakWindow,
        peakTime: peakTime,
        peakTimeSubtitle: "Today (projected peak step)",
        peakProbabilityPct: maxProb,
        peakProbabilitySubtitle: "High risk across commercial zones",
        isHighRisk: true,
      };
    } else {
      // Selected Locality
      const loc = localities.find((l) => l.id === selectedLocalityId);
      if (!loc) return null;
      const fc = forecasts[loc.id];

      const curLoad = fc?.summary?.currentLoadMw ?? loc.current_demand_mw;
      const predPeak = fc?.peakAnalysis?.predictedPeakMw ?? loc.current_demand_mw * 1.25;
      const thresh = fc?.peakAnalysis?.thresholdMw ?? loc.peak_threshold_mw;
      const prob = fc?.peakAnalysis?.peakProbabilityPct ?? 0;
      const pTime = fc?.peakAnalysis?.peakTime ?? `${loc.typical_peak_hour}:00`;
      const exceed = fc?.peakAnalysis?.exceedanceMw ?? Math.max(0, predPeak - thresh);
      const isHigh = prob > 50 || predPeak > thresh;

      const pWindow = fc?.summary?.predictedPeakWindow
        ? `${fc.summary.predictedPeakWindow.start} – ${fc.summary.predictedPeakWindow.end}`
        : `Peak step at ${pTime}`;

      return {
        currentLoadMw: curLoad,
        currentLoadSubtitle: `${loc.name} baseline load`,
        predictedPeakMw: predPeak,
        predictedPeakWindow: pWindow,
        peakTime: pTime,
        peakTimeSubtitle: "Projected peak step",
        peakProbabilityPct: prob,
        peakProbabilitySubtitle:
          exceed > 0 ? `+${exceed.toFixed(1)} MW above threshold` : "Within threshold limit",
        isHighRisk: isHigh,
      };
    }
  }, [selectedLocalityId, localities, forecasts, activeSeries]);

  const selectedLocality =
    selectedLocalityId === "all"
      ? null
      : localities.find((l) => l.id === selectedLocalityId);

  const scopeName = selectedLocality ? selectedLocality.name : "Mumbai";
  const solarCapacity = selectedLocality
    ? selectedLocality.solar_capacity_mw
    : localities.reduce((acc, l) => acc + l.solar_capacity_mw, 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <main className="mx-auto flex max-w-7xl flex-1 flex-col gap-6 p-6 sm:p-8">
        {/* Header */}
        <DashboardHeader
          localities={localities}
          selectedLocalityId={selectedLocalityId}
          onSelectLocality={setSelectedLocalityId}
          onRefresh={loadDashboardData}
          isRefreshing={isRefreshing}
          isOnline={isOnline}
        />

        {/* Top KPI Cards */}
        <DashboardKpiGrid data={kpiData} loading={loading} />

        {/* Middle Section: Demand Chart (Left) + Locality Risk Map (Right) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Demand Chart: 7 Columns */}
          <div className="lg:col-span-7">
            <DashboardDemandChart
              points={activeSeries}
              scopeName={scopeName}
              solarCapacityMw={solarCapacity}
              loading={loading}
            />
          </div>

          {/* Locality Risk Map: 5 Columns */}
          <div className="lg:col-span-5">
            <DashboardLocalityRisk
              localities={localities}
              forecasts={forecasts}
              selectedLocalityId={selectedLocalityId}
              onSelectLocality={setSelectedLocalityId}
            />
          </div>
        </div>

        {/* Bottom AI Insight Card */}
        <DashboardAiInsight
          explanation={explanation}
          scopeName={scopeName}
          loading={loading}
        />

        {/* Footer Provenance Disclaimer Banner */}
        <DashboardFooterBanner />
      </main>
    </div>
  );
}
