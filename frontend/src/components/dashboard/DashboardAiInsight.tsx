"use client";

import Link from "next/link";
import { Lightbulb, ArrowRight } from "lucide-react";
import type { ExplanationData } from "@/types/forecast";

export default function DashboardAiInsight({
  explanation,
  scopeName = "Mumbai",
  loading = false,
}: {
  explanation: ExplanationData | null;
  scopeName?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-100" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-28 animate-pulse rounded-md bg-slate-100" />
            <div className="h-4 w-96 animate-pulse rounded-md bg-slate-100" />
            <div className="h-3.5 w-64 animate-pulse rounded-md bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  // Derive honest summary based on real SHAP drivers if available
  const topDriver = explanation?.drivers?.[0];
  const secondDriver = explanation?.drivers?.[1];

  let insightHeadline =
    "Peak risk is elevated during evening hours due to synchronous residential return and commercial demand ramp-up.";
  let insightDetail =
    "Commercial cooling loads and thermal inertia are the primary contributors to threshold strain.";

  if (topDriver) {
    insightHeadline = `Peak demand for ${scopeName} is driven upward primarily by ${topDriver.label} (${
      topDriver.shapValueMw > 0 ? `+${topDriver.shapValueMw.toFixed(1)}` : topDriver.shapValueMw.toFixed(1)
    } MW contribution).`;

    if (secondDriver) {
      insightDetail = `Secondary strain factors include ${secondDriver.label} and ambient thermal conditions.`;
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
      {/* Left Icon + Insight Copy */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Lightbulb className="h-6 w-6 fill-emerald-600/15" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold tracking-tight text-slate-900">AI Insight</h3>
          <p className="text-sm font-medium text-slate-700 leading-relaxed">
            {insightHeadline}
          </p>
          <p className="text-xs font-normal text-slate-500 leading-relaxed">
            {insightDetail}
          </p>
        </div>
      </div>

      {/* Right CTA Button */}
      <div className="shrink-0 pt-2 sm:pt-0">
        <Link
          href="/peak-prevention"
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900"
        >
          <span>Understand the peak</span>
          <ArrowRight className="h-4 w-4 text-slate-500" />
        </Link>
      </div>
    </div>
  );
}
