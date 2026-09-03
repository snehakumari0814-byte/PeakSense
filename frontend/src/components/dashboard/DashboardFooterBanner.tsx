"use client";

import { Info } from "lucide-react";

export default function DashboardFooterBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-100/70 px-4 py-3 text-xs text-slate-600 shadow-2xs">
      <Info className="h-4 w-4 shrink-0 text-slate-500" />
      <span>
        All data shown is based on demo inputs and AI-generated forecasts. Not real-time grid data.
      </span>
    </div>
  );
}
