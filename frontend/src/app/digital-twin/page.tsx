"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Compass, RefreshCw } from "lucide-react";
import Topbar from "@/components/Topbar";
import LocalityInfoPanel from "@/components/twin/LocalityInfoPanel";
import { fetchLocalities, fetchForecast } from "@/lib/api";
import { mockForecast } from "@/lib/forecast";
import type { Locality } from "@/types/locality";
import type { ForecastResponse } from "@/types/forecast";

const MumbaiDigitalTwin = dynamic(
  () => import("@/components/twin/MumbaiDigitalTwin"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-500">
        Loading 3D Digital Twin…
      </div>
    ),
  },
);

type BackendStatus = "checking" | "live" | "fallback";
type LoadState = "loading" | "ready" | "error";

export default function DigitalTwinPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [forecasts, setForecasts] = useState<Record<string, ForecastResponse>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listState, setListState] = useState<LoadState>("loading");
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch live localities from GET /api/localities
      const locList = await fetchLocalities();
      setLocalities(locList);

      // 2. Fetch live 24h ML forecasts for all localities in parallel
      const forecastResults = await Promise.allSettled(
        locList.map((loc) => fetchForecast(loc.id, "24h")),
      );

      const forecastMap: Record<string, ForecastResponse> = {};
      let hasLive = false;

      forecastResults.forEach((res, idx) => {
        const loc = locList[idx];
        if (res.status === "fulfilled") {
          forecastMap[loc.id] = res.value.data;
          if (!res.value.isDemoFallback) {
            hasLive = true;
          }
        } else {
          // Fallback mock forecast for this locality
          forecastMap[loc.id] = mockForecast(loc, "24h");
        }
      });

      setForecasts(forecastMap);
      setBackendStatus(hasLive ? "live" : "fallback");
      setListState("ready");

      // Default selection to first locality if none selected
      setSelectedId((prev) => prev ?? (locList.length > 0 ? locList[0].id : null));
    } catch {
      // Backend unreachable: generate fallback mock forecasts
      setBackendStatus("fallback");
      setListState("error");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedLocality = useMemo(
    () => localities.find((l) => l.id === selectedId) ?? null,
    [localities, selectedId],
  );

  const selectedForecast = useMemo(
    () => (selectedId ? forecasts[selectedId] ?? null : null),
    [selectedId, forecasts],
  );

  return (
    <>
      <Topbar title="Mumbai Digital Twin" />
      <main className="flex flex-1 flex-col gap-3 overflow-hidden p-6">
        {/* Live Status Attribution Banner */}
        {backendStatus === "live" && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-emerald-400">LIVE MODEL</span>
              <span className="text-slate-300">
                — Real-time locality demand and 24h ML forecasts visualized over a stylized 3D Mumbai Digital Twin.
              </span>
            </div>
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        )}

        {backendStatus === "fallback" && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="font-semibold text-amber-400">DEMO FALLBACK</span>
              <span className="text-slate-300">
                — Backend API unreachable. Showing prototype/seeded values.
              </span>
            </div>
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
              Retry
            </button>
          </div>
        )}

        {listState === "loading" && (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            Loading Mumbai locality and forecast data…
          </div>
        )}

        {listState === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-red-400">
            <p>Could not reach the backend at the configured API URL.</p>
            <p className="text-xs text-slate-500">
              Make sure the FastAPI server is running on port 8000.
            </p>
            <button
              onClick={loadData}
              className="mt-2 flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry Connection
            </button>
          </div>
        )}

        {listState === "ready" && (
          <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="flex-1">
              <MumbaiDigitalTwin
                localities={localities}
                forecasts={forecasts}
                backendStatus={backendStatus}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReset={() => setSelectedId(null)}
              />
            </div>

            <div className="w-80 shrink-0">
              {selectedLocality ? (
                <LocalityInfoPanel
                  locality={selectedLocality}
                  forecast={selectedForecast}
                  isLive={backendStatus === "live"}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-6 text-center text-sm text-slate-500">
                  <Compass className="h-5 w-5" />
                  Click a locality zone in the 3D twin to view its profile
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
