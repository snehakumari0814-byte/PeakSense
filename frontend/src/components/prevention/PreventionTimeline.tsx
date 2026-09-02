import type { TimelineEvent } from "@/types/prevention";
import { RISK_COLORS } from "@/lib/risk";
import DemoDataBadge from "@/components/DemoDataBadge";

export default function PreventionTimeline({
  timeline,
  isDemoData,
}: {
  timeline: TimelineEvent[];
  isDemoData: boolean;
}) {
  const isLive = !isDemoData;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
          Prevention Timeline
        </h2>
        {isLive ? (
          <DemoDataBadge variant="live" label="Forecast · Live" />
        ) : (
          <DemoDataBadge variant="fallback" label="Demo Fallback" />
        )}
      </div>

      <div className="relative flex items-start justify-between overflow-x-auto pb-2">
        <div className="absolute left-0 right-0 top-2.5 h-px bg-slate-800" />
        {timeline.map((event) => {
          const color = RISK_COLORS[event.risk];
          return (
            <div
              key={event.timestamp}
              className="relative flex min-w-[92px] flex-col items-center px-1 text-center"
            >
              <span
                className={`z-10 rounded-full border-2 border-slate-950 ${
                  event.isPeak ? "h-4 w-4" : "h-3 w-3"
                }`}
                style={{ backgroundColor: color }}
              />
              <span className="mt-2 text-xs font-medium text-white">{event.time}</span>
              <span
                className={`mt-0.5 text-[11px] ${event.isPeak ? "font-semibold" : ""}`}
                style={{ color }}
              >
                {event.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        {isLive
          ? "Timestamps derived from real forecast series. Stages reflect when model-predicted demand crosses risk thresholds."
          : "Intervention is most effective before the risk crosses into HIGH — ideally starting at the \u201cDemand ramp\u201d stage."}
      </p>
    </div>
  );
}
