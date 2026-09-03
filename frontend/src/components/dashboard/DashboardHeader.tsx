"use client";

import { useState, useEffect } from "react";
import { ChevronDown, RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { Locality } from "@/types/locality";

export default function DashboardHeader({
  localities,
  selectedLocalityId,
  onSelectLocality,
  onRefresh,
  isRefreshing = false,
  isOnline = true,
}: {
  localities: Locality[];
  selectedLocalityId: string | "all";
  onSelectLocality: (id: string | "all") => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  isOnline?: boolean;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    function updateTime() {
      const now = new Date();
      const formatted = now.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      setCurrentTime(`${formatted}, ${timeStr} IST`);
    }

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const selectedLocality =
    selectedLocalityId === "all"
      ? null
      : localities.find((l) => l.id === selectedLocalityId);

  const displayTitle = selectedLocality ? selectedLocality.name : "Mumbai";
  const displaySubtitle = selectedLocality
    ? `Locality Profile · ${selectedLocality.demand_profile.replace(/_/g, " ")}`
    : "City Overview";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Scope / Location Title */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="group flex items-center gap-2 text-left"
        >
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {displayTitle}
              </h1>
              <ChevronDown
                className={`h-5 w-5 text-slate-400 transition-transform group-hover:text-slate-700 ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </div>
            <p className="text-xs font-medium text-slate-500">{displaySubtitle}</p>
          </div>
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <button
              type="button"
              onClick={() => {
                onSelectLocality("all");
                setDropdownOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                selectedLocalityId === "all"
                  ? "bg-emerald-50 text-emerald-800 font-semibold"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>Mumbai (City Overview)</span>
              <span className="text-[10px] text-slate-400">10 Localities</span>
            </button>
            <div className="my-1 border-t border-slate-100" />
            <div className="max-h-56 overflow-y-auto">
              {localities.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    onSelectLocality(loc.id);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    selectedLocalityId === loc.id
                      ? "bg-emerald-50 text-emerald-800 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{loc.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {loc.current_demand_mw} MW
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Controls: Date/Time, Refresh, Scope Dropdown, Backend Status */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date / Time */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-2xs">
          <span>📅</span>
          <span>{currentTime || "Loading time…"}</span>
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          title="Refresh forecast data"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`}
          />
        </button>

        {/* Scope Selector Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition-colors hover:bg-slate-50"
          >
            <span>{displayTitle}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>

        {/* Backend Status Indicator */}
        <div
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium shadow-2xs ${
            isOnline
              ? "border-emerald-200 bg-emerald-50/70 text-emerald-700"
              : "border-amber-200 bg-amber-50/70 text-amber-700"
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden md:inline">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-amber-600" />
              <span className="hidden md:inline">Offline (Fallback)</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
