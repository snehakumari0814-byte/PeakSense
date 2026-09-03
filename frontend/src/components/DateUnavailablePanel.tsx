import { CalendarOff } from "lucide-react";
import { formatDateForDisplay, getTodayDate, type DateString } from "@/lib/date";

/**
 * Shown instead of forecast content when the backend genuinely cannot
 * produce a forecast for the requested date (a real gap in the historical
 * dataset, or beyond the future-forecast cap) — reflects the backend's own
 * error `detail`, and never renders stale or fabricated data.
 */
export default function DateUnavailablePanel({
  requestedDate,
  detail,
  onUseToday,
}: {
  requestedDate: DateString;
  /** The backend's own honest explanation of why this date can't be served. */
  detail?: string;
  onUseToday: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-ps-border bg-ps-card p-8 text-center shadow-sm">
      <CalendarOff className="h-6 w-6 text-ps-text-muted" />
      <p className="text-sm font-medium text-ps-text-primary">
        Forecast unavailable for {formatDateForDisplay(requestedDate)}.
      </p>
      <p className="max-w-md text-xs text-ps-text-secondary">
        {detail ?? "This date is outside the backend's genuinely supported forecast range."}
      </p>
      <button
        type="button"
        onClick={onUseToday}
        className="mt-2 rounded-md border border-ps-border bg-ps-background px-3 py-1.5 text-xs font-medium text-ps-text-secondary hover:text-ps-text-primary"
      >
        View {formatDateForDisplay(getTodayDate())}
      </button>
    </div>
  );
}
