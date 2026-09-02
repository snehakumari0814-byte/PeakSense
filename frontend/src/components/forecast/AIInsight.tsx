import { Lightbulb, ArrowRight } from "lucide-react";
import type { AIInsight as AIInsightData } from "@/types/forecast";
import DemoDataBadge from "@/components/DemoDataBadge";

export default function AIInsight({ insight }: { insight: AIInsightData }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
            <Lightbulb className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">AI Insight</h2>
              <DemoDataBadge label="Demo" />
            </div>
            <p className="mt-1 text-sm text-slate-300">{insight.summary}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 pl-11">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Primary drivers
          </span>
          {insight.drivers.map((driver) => (
            <span
              key={driver}
              className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300"
            >
              {driver}
            </span>
          ))}
        </div>

        <button
          type="button"
          disabled
          title="Explanation API not yet connected"
          className="ml-auto flex cursor-not-allowed items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-500"
        >
          Understand the peak
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
