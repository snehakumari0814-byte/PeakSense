import type { TimelineEvent } from "@/types/prevention";
import { RISK_COLORS } from "@/lib/risk";

export default function PreventionTimeline({
  timeline,
}: {
  timeline: TimelineEvent[];
  isDemoData: boolean;
}) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-5 shadow-sm">
      <h2 className="mb-5 text-sm font-semibold text-ps-text-primary">Prevention timeline</h2>

      <div className="relative flex items-start justify-between overflow-x-auto pb-2">
        <div className="absolute left-0 right-0 top-2.5 h-px bg-ps-border" />
        {timeline.map((event) => {
          const color = RISK_COLORS[event.risk];
          return (
            <div
              key={event.timestamp}
              className="relative flex min-w-[92px] flex-col items-center px-1 text-center"
            >
              <span
                className={`z-10 rounded-full border-2 border-ps-card ${
                  event.isPeak ? "h-4 w-4" : "h-3 w-3"
                }`}
                style={{ backgroundColor: color }}
              />
              <span className="mt-2 text-xs font-medium text-ps-text-primary">{event.time}</span>
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

      <p className="mt-3 text-xs leading-relaxed text-ps-text-muted">
        Intervention is most effective before the risk crosses into high — ideally starting at
        the &ldquo;Demand ramp&rdquo; stage.
      </p>
    </div>
  );
}
