"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  Legend,
} from "recharts";
import type { ForecastSeries } from "@/types/forecast";

const ACTUAL_COLOR = "#2563eb";
const PREDICTED_COLOR = "#16a34a";
const BAND_COLOR = "#16a34a";
const THRESHOLD_COLOR = "#dc2626";
const PEAK_COLOR = "#d97706";
const GRID_COLOR = "#e2e8f0";
const AXIS_COLOR = "#94a3b8";

function ForecastTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-ps-border bg-ps-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-ps-text-primary">{label}</p>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined && !Number.isNaN(p.value))
        .map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value} MW
          </p>
        ))}
    </div>
  );
}

export default function ForecastChart({ series }: { series: ForecastSeries; isLive?: boolean }) {
  const chartData = series.points.map((p) => ({
    time: p.time,
    timestamp: p.timestamp,
    Actual: p.actualMw,
    Predicted: p.predictedMw,
    band: p.lowerMw !== null && p.upperMw !== null ? [p.lowerMw, p.upperMw] : null,
  }));

  const peakPoint = chartData.find((p) => p.timestamp === series.peakTimestamp);

  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ps-text-primary">Demand forecast</h2>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              stroke={AXIS_COLOR}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              minTickGap={24}
              label={{ value: "Time", position: "insideBottom", offset: -2, fill: AXIS_COLOR, fontSize: 11 }}
            />
            <YAxis
              stroke={AXIS_COLOR}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              width={44}
              label={{ value: "MW", angle: -90, position: "insideLeft", fill: AXIS_COLOR, fontSize: 11 }}
            />
            <Tooltip content={<ForecastTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} iconSize={8} />

            <Area
              type="monotone"
              dataKey="band"
              name="Confidence range"
              stroke="none"
              fill={BAND_COLOR}
              fillOpacity={0.1}
              isAnimationActive={false}
            />

            <ReferenceLine
              y={series.thresholdMw}
              stroke={THRESHOLD_COLOR}
              strokeDasharray="4 4"
              strokeOpacity={0.8}
              label={{
                value: `Threshold ${series.thresholdMw} MW`,
                position: "right",
                fill: THRESHOLD_COLOR,
                fontSize: 10,
              }}
            />

            <Line
              type="monotone"
              dataKey="Actual"
              stroke={ACTUAL_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="Predicted"
              stroke={PREDICTED_COLOR}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            {peakPoint && (
              <ReferenceLine
                x={peakPoint.time}
                stroke={PEAK_COLOR}
                strokeOpacity={0.6}
                label={{ value: `Peak ${peakPoint.time}`, position: "top", fill: PEAK_COLOR, fontSize: 10 }}
              />
            )}
            {peakPoint && peakPoint.Predicted !== null && (
              <ReferenceDot
                x={peakPoint.time}
                y={peakPoint.Predicted ?? undefined}
                r={5}
                fill={PEAK_COLOR}
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
