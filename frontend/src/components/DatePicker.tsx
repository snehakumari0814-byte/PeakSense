"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  formatDateForDisplay,
  getMonthLabel,
  getMonthMatrix,
  isDateAvailable,
  startOfMonth,
  WEEKDAY_NAMES,
  type DateAvailability,
  type DateString,
} from "@/lib/date";

/**
 * Shared date picker used by Forecast, Peak Prevention, and the Simulator.
 *
 * Dates are enabled/disabled against the backend's genuine, data-derived
 * availability (GET /api/forecast/availability — a historical backtest
 * range and a live/future forecast range). Every other day in the grid is
 * visibly disabled with an explanation, not hidden or faked.
 */
export default function DatePicker({
  selectedDate,
  availability,
  onSelect,
  disabled = false,
}: {
  selectedDate: DateString;
  /** Real backend-derived date availability, or null while unknown/loading. */
  availability: DateAvailability | null;
  onSelect: (date: DateString) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<DateString>(startOfMonth(selectedDate));
  const [blockedMessage, setBlockedMessage] = useState<DateString | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setViewMonth(startOfMonth(selectedDate));
      setBlockedMessage(null);
    }
  }, [open, selectedDate]);

  const days = getMonthMatrix(viewMonth);

  function handleDayClick(date: DateString) {
    if (!isDateAvailable(date, availability)) {
      setBlockedMessage(date);
      return;
    }
    setBlockedMessage(null);
    onSelect(date);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-ps-border bg-ps-card px-3 py-1.5 text-xs font-medium text-ps-text-secondary transition-colors hover:text-ps-text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Calendar className="h-3.5 w-3.5 text-ps-text-muted" />
        {formatDateForDisplay(selectedDate)}
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-72 rounded-xl border border-ps-border bg-ps-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="rounded p-1 text-ps-text-muted hover:bg-ps-background hover:text-ps-text-primary"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-ps-text-primary">
              {getMonthLabel(viewMonth)}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded p-1 text-ps-text-muted hover:bg-ps-background hover:text-ps-text-primary"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-ps-text-muted">
            {WEEKDAY_NAMES.map((w) => (
              <div key={w} className="py-1">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const available = isDateAvailable(day.date, availability);
              const isSelected = day.date === selectedDate;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => handleDayClick(day.date)}
                  title={available ? undefined : "Forecast unavailable for this date"}
                  className={`flex h-8 w-full items-center justify-center rounded-md text-xs transition-colors ${
                    !day.inCurrentMonth ? "text-ps-text-muted/40" : "text-ps-text-secondary"
                  } ${
                    isSelected && available
                      ? "bg-ps-success text-white font-semibold"
                      : available
                        ? "hover:bg-ps-success-soft hover:text-ps-success"
                        : "cursor-not-allowed opacity-35"
                  }`}
                >
                  {day.dayOfMonth}
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-ps-border pt-2 text-[11px] leading-relaxed text-ps-text-muted">
            {blockedMessage ? (
              <span className="text-ps-warning">
                Forecast unavailable for {formatDateForDisplay(blockedMessage)}.
              </span>
            ) : availability ? (
              <>
                {availability.historicalRange && (
                  <>
                    Historical: {formatDateForDisplay(availability.historicalRange.start)} –{" "}
                    {formatDateForDisplay(availability.historicalRange.end)}.{" "}
                  </>
                )}
                Forecastable: {formatDateForDisplay(availability.forecastableRange.start)} –{" "}
                {formatDateForDisplay(availability.forecastableRange.end)}.
              </>
            ) : (
              <>Checking which dates the backend can currently forecast…</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
