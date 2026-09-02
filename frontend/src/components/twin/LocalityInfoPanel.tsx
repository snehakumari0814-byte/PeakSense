"use client";

import Link from "next/link";
import {
  Gauge,
  Sun,
  Clock,
  Thermometer,
  Home,
  Building2,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Percent,
  AlertTriangle,
  Zap,
} from "lucide-react";
import type { Locality } from "@/types/locality";
import type { ForecastResponse } from "@/types/forecast";
import { riskLevel, demandRatio, RISK_COLORS, RISK_LABELS, type RiskLevel } from "@/lib/risk";

function MetricItem({
  icon: Icon,
  label,
  value,
  highlight = false,
  highlightColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
  highlightColor?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
      <span className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
      <span
        className={`text-xs font-semibold ${
          highlight && highlightColor ? "" : "text-white"
        }`}
        style={highlight && highlightColor ? { color: highlightColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export default function LocalityInfoPanel({
  locality,
  forecast,
  isLive = true,
}: {
  locality: Locality;
  forecast?: ForecastResponse | null;
  isLive?: boolean;
}) {
  // Live values from ML forecast endpoint with fallback to locality baseline
  const risk: RiskLevel = forecast?.peakAnalysis?.risk ?? riskLevel(locality);
  const currentDemand = forecast?.summary?.currentLoadMw ?? locality.current_demand_mw;
  const predictedPeak = forecast?.peakAnalysis?.predictedPeakMw ?? locality.current_demand_mw;
  const threshold = forecast?.peakAnalysis?.thresholdMw ?? locality.peak_threshold_mw;
  const probabilityPct = forecast?.peakAnalysis?.peakProbabilityPct ?? 0;
  const peakTime = forecast?.peakAnalysis?.peakTime ?? `${locality.typical_peak_hour}:00`;
  const exceedanceMw = forecast?.peakAnalysis?.exceedanceMw ?? Math.max(0, predictedPeak - threshold);
  const ratio = threshold > 0 ? currentDemand / threshold : demandRatio(locality);
  const riskColor = RISK_COLORS[risk];

  return (
    <div className="flex h-full flex-col gap-3.5 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">{locality.name}</h2>
          <p className="text-[11px] text-slate-500">
            {locality.latitude.toFixed(4)}°N, {locality.longitude.toFixed(4)}°E
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide"
            style={{
              borderColor: `${riskColor}55`,
              backgroundColor: `${riskColor}1a`,
              color: riskColor,
            }}
          >
            {RISK_LABELS[risk].toUpperCase()}
          </span>
          {isLive ? (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              LIVE FORECAST
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              DEMO DATA
            </span>
          )}
        </div>
      </div>

      {/* Live Risk Status Banner */}
      <div
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold"
        style={{
          borderColor: `${riskColor}4d`,
          backgroundColor: `${riskColor}15`,
          color: riskColor,
        }}
      >
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          Peak risk: {RISK_LABELS[risk]} ({Math.round(ratio * 100)}% of threshold)
        </span>
      </div>

      {/* Real-time ML Forecast Section */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            24h ML Forecast
          </span>
          <span className="text-[9px] text-emerald-400/80 font-mono">/api/forecast</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <MetricItem
            icon={Gauge}
            label="Current demand"
            value={`${currentDemand.toFixed(1)} MW`}
          />
          <MetricItem
            icon={TrendingUp}
            label="Predicted peak"
            value={`${predictedPeak.toFixed(1)} MW`}
            highlight={predictedPeak > threshold}
            highlightColor="#f87171"
          />
          <MetricItem
            icon={Zap}
            label="Threshold limit"
            value={`${threshold.toFixed(1)} MW`}
          />
          <MetricItem
            icon={Percent}
            label="Peak probability"
            value={`${probabilityPct}%`}
            highlight={probabilityPct > 60}
            highlightColor={riskColor}
          />
          <MetricItem
            icon={Clock}
            label="Projected peak time"
            value={peakTime}
          />
          <MetricItem
            icon={AlertTriangle}
            label="Threshold exceedance"
            value={exceedanceMw > 0 ? `+${exceedanceMw.toFixed(1)} MW` : "0.0 MW (Within limit)"}
            highlight={exceedanceMw > 0}
            highlightColor="#f87171"
          />
        </div>
      </div>

      {/* Contextual Locality Profile */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Locality Profile
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Home className="h-3 w-3" /> Res. share
            </span>
            <span className="text-xs font-semibold text-white">
              {Math.round(locality.residential_share * 100)}%
            </span>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Building2 className="h-3 w-3" /> Comm. share
            </span>
            <span className="text-xs font-semibold text-white">
              {Math.round(locality.commercial_share * 100)}%
            </span>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Sun className="h-3 w-3" /> Solar cap. (proto)
            </span>
            <span className="text-xs font-semibold text-white">
              {locality.solar_capacity_mw.toFixed(1)} MW
            </span>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Thermometer className="h-3 w-3" /> Cooling sens.
            </span>
            <span className="text-xs font-semibold text-white">
              {Math.round(locality.cooling_sensitivity * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Honest Disclaimer */}
      <p className="text-[10px] leading-relaxed text-slate-500">
        Live locality demand and 24h ML peak forecast over a stylized 3D Mumbai Digital Twin.
        Zone boundaries and electricity-flow lines are illustrative representations.
      </p>

      {/* Navigation CTA Links */}
      <div className="mt-auto flex flex-col gap-1.5 pt-1">
        <Link
          href="/forecast"
          className="flex items-center justify-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
        >
          <span>View Forecast Curves</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/peak-prevention"
          className="flex items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <span>Mitigation Options</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
