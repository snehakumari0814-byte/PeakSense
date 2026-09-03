/**
 * Shared date utilities for PeakSense.
 *
 * Canonical date representation across the app is a plain "YYYY-MM-DD"
 * string (a DateString), never a raw `Date` object. `Date` objects are only
 * ever constructed transiently inside a function and immediately
 * re-serialized back to a DateString — this avoids the classic bug where
 * converting between local time and UTC silently shifts the selected
 * calendar day by ±1.
 *
 * IMPORTANT — backend date support:
 * GET /api/forecast, GET /api/forecast/series, GET /api/explanation,
 * GET /api/forecast/inputs, GET /api/recommendations, and POST /api/simulate
 * all accept an optional `date=YYYY-MM-DD` query/body parameter. The
 * genuinely supported date range is served by GET /api/forecast/availability
 * (see fetchForecastAvailability() in lib/api.ts) as two data-derived
 * ranges — a historical backtest range and a live/future forecast range —
 * never invented client-side. `isDateAvailable()` below checks a date
 * against that real availability document.
 */

export type DateString = string; // "YYYY-MM-DD"

/** A real, backend-derived date range (inclusive, both ends "YYYY-MM-DD"). */
export type DateRange = { start: DateString; end: DateString };

/**
 * Genuine date availability as reported by GET /api/forecast/availability.
 * `historicalRange` is null only if the backend has no historical data
 * loaded at all. A date strictly between the two ranges is a real gap in
 * the underlying dataset — not available.
 */
export type DateAvailability = {
  referenceDate: DateString;
  historicalRange: DateRange | null;
  forecastableRange: DateRange;
  minDate: DateString;
  maxDate: DateString;
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Client-side "today" — used only as a provisional initial guess before
 * any backend response has confirmed the actual supported date. */
export function getTodayDate(): DateString {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Extract the calendar date portion from a full ISO 8601 timestamp string
 * (e.g. "2026-09-03T20:15:00+05:30" -> "2026-09-03"). Pure string slicing —
 * no Date object, so the timestamp's own embedded offset is respected
 * exactly instead of being reinterpreted in the browser's local timezone.
 */
export function isoDateOnly(iso: string): DateString {
  return iso.slice(0, 10);
}

/** Identity today — kept as a named function so call sites read clearly
 * and so a future backend `?date=` parameter can be wired in one place. */
export function formatDateForApi(date: DateString): DateString {
  return date;
}

/** "2026-09-03" -> "03 Sep 2026". Parsed as plain numbers, no Date/timezone involved. */
export function formatDateForDisplay(date: DateString): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return `${pad2(d)} ${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * A date is available if it falls inside the backend's real historical
 * range OR its real forecastable (current/future) range — both taken
 * directly from GET /api/forecast/availability. Plain "YYYY-MM-DD" strings
 * compare lexicographically the same as chronologically, so no Date object
 * is needed here.
 */
export function isDateAvailable(date: DateString, availability: DateAvailability | null): boolean {
  if (!availability) return false;
  const { historicalRange, forecastableRange } = availability;
  const inHistorical = !!historicalRange && date >= historicalRange.start && date <= historicalRange.end;
  const inForecastable = date >= forecastableRange.start && date <= forecastableRange.end;
  return inHistorical || inForecastable;
}

export function isValidDateString(value: string | null | undefined): value is DateString {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Calendar-day arithmetic for month-grid navigation only. Anchors at UTC
 * noon so DST/timezone transitions can never shift the resulting day, then
 * immediately re-serializes to a plain YYYY-MM-DD string. */
export function addDays(date: DateString, delta: number): DateString {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function startOfMonth(date: DateString): DateString {
  const [y, m] = date.split("-").map(Number);
  return `${y}-${pad2(m ?? 1)}-01`;
}

export function addMonths(date: DateString, delta: number): DateString {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1 + delta, 1, 12, 0, 0));
  const daysInTarget = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d ?? 1, daysInTarget);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(clampedDay)}`;
}

export type CalendarDay = {
  date: DateString;
  dayOfMonth: number;
  inCurrentMonth: boolean;
};

/** Builds a 6x7 month grid (always full weeks) for the month containing `anchorDate`. */
export function getMonthMatrix(anchorDate: DateString): CalendarDay[] {
  const [y, m] = anchorDate.split("-").map(Number);
  const first = new Date(Date.UTC(y, (m ?? 1) - 1, 1, 12, 0, 0));
  const startWeekday = first.getUTCDay(); // 0 = Sunday
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - startWeekday);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    days.push({
      date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
      dayOfMonth: d.getUTCDate(),
      inCurrentMonth: d.getUTCMonth() === (m ?? 1) - 1,
    });
  }
  return days;
}

export function getMonthLabel(date: DateString): string {
  const [y, m] = date.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

export { MONTH_NAMES, WEEKDAY_NAMES };
