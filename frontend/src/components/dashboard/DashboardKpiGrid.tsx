"use client";

import { Zap, TrendingUp, Clock, ShieldCheck, ShieldAlert } from "lucide-react";

export type DashboardKpiData = {
  currentLoadMw: number;
  currentLoadSubtitle: string;
  predictedPeakMw: number;
  predictedPeakWindow: string;
  peakTime: string;
  peakTimeSubtitle: string;
  peakProbabilityPct: number;
  peakProbabilitySubtitle: string;
  isHighRisk?: boolean;
};

export default function DashboardKpiGrid({
  data,
  loading = false,
}: {
  data: DashboardKpiData | null;
  loading?: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
              <div className="h-4 w-24 animate-pulse rounded-md bg-slate-100" />
            </div>
            <div className="my-3 h-8 w-32 animate-pulse rounded-md bg-slate-100" />
            <div className="h-3.5 w-28 animate-pulse rounded-md bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Current Load */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs transition-shadow hover:shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Zap className="h-5 w-5 fill-emerald-600/20" />
          </div>
          <span className="text-xs font-semibold text-slate-500">Current Load</span>
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {data.currentLoadMw.toLocaleString("en-US", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </span>
          <span className="text-xs font-semibold text-slate-500">MW</span>
        </div>
        <p className="text-xs font-medium text-slate-500">{data.currentLoadSubtitle}</p>
      </div>

      {/* 2. Predicted Peak */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs transition-shadow hover:shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold text-slate-500">Predicted Peak</span>
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-blue-600">
            {data.predictedPeakMw.toLocaleString("en-US", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </span>
          <span className="text-xs font-semibold text-slate-500">MW</span>
        </div>
        <p className="text-xs font-medium text-slate-500">{data.predictedPeakWindow}</p>
      </div>

      {/* 3. Peak Time */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs transition-shadow hover:shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Clock className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold text-slate-500">Peak Time</span>
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-indigo-600">
            {data.peakTime}
          </span>
        </div>
        <p className="text-xs font-medium text-slate-500">{data.peakTimeSubtitle}</p>
      </div>

      {/* 4. Peak Probability */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs transition-shadow hover:shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            {data.isHighRisk ? (
              <ShieldAlert className="h-5 w-5 text-amber-600" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-sky-600" />
            )}
          </div>
          <span className="text-xs font-semibold text-slate-500">Peak Probability</span>
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span
            className={`text-2xl font-bold tracking-tight ${
              data.isHighRisk ? "text-amber-600" : "text-sky-600"
            }`}
          >
            {data.peakProbabilityPct}%
          </span>
        </div>
        <p className="text-xs font-medium text-slate-500">
          {data.peakProbabilitySubtitle}
        </p>
      </div>
    </div>
  );
}
