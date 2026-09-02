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
import DemoDataBadge from "@/components/DemoDataBadge";

const ACTUAL_COLOR = "#60a5fa";
const PREDICTED_COLOR = "#22d3ee";
const BAND_COLOR = "#22d3ee";
const THRESHOLD_COLOR = "#f87171";

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
    <div className="rounded-md border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-300">{label}</p>
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

export default function ForecastChart({ series, isLive }: { series: ForecastSeries; isLive?: boolean }) {
  const chartData = series.points.map((p) => ({
    time: p.time,
    timestamp: p.timestamp,
    Actual: p.actualMw,
    Predicted: p.predictedMw,
    band: p.lowerMw !== null && p.upperMw !== null ? [p.lowerMw, p.upperMw] : null,
  }));

  const peakPoint = chartData.find((p) => p.timestamp === series.peakTimestamp);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Demand Forecast</h2>
        <DemoDataBadge variant={isLive ? "live" : "fallback"} label={isLive ? "Live" : "Fallback"} />
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#475569"
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              minTickGap={24}
              label={{ value: "Time", position: "insideBottom", offset: -2, fill: "#475569", fontSize: 11 }}
            />
            <YAxis
              stroke="#475569"
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              width={44}
              label={{ value: "MW", angle: -90, position: "insideLeft", fill: "#475569", fontSize: 11 }}
            />
            <Tooltip content={<ForecastTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} iconSize={8} />

            <Area
              type="monotone"
              dataKey="band"
              name="Confidence range"
              stroke="none"
              fill={BAND_COLOR}
              fillOpacity={0.12}
              isAnimationActive={false}
            />

            <ReferenceLine
              y={series.thresholdMw}
              stroke={THRESHOLD_COLOR}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
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
                stroke="#facc15"
                strokeOpacity={0.6}
                label={{ value: `Peak ${peakPoint.time}`, position: "top", fill: "#facc15", fontSize: 10 }}
              />
            )}
            {peakPoint && peakPoint.Predicted !== null && (
              <ReferenceDot
                x={peakPoint.time}
                y={peakPoint.Predicted ?? undefined}
                r={5}
                fill="#facc15"
                stroke="#0f172a"
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
