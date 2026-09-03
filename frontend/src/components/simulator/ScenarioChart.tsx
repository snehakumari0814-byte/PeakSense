"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  Legend,
} from "recharts";
import type { SimulationResult } from "@/types/simulator";

const BASELINE_COLOR = "#2563eb";
const SIMULATED_COLOR = "#16a34a";
const THRESHOLD_COLOR = "#dc2626";
const GRID_COLOR = "#e2e8f0";
const AXIS_COLOR = "#94a3b8";

function ChartTooltip({
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

export default function ScenarioChart({ result }: { result: SimulationResult }) {
  const chartData = result.series.map((p) => ({
    time: p.time,
    timestamp: p.timestamp,
    Baseline: p.baselineMw,
    Simulated: p.simulatedMw,
  }));

  const baselinePeakPoint = chartData.reduce(
    (best, p) => (p.Baseline !== null && p.Baseline > (best?.Baseline ?? -Infinity) ? p : best),
    chartData[0],
  );
  const scenarioPeakPoint = chartData.reduce(
    (best, p) => (p.Simulated !== null && p.Simulated > (best?.Simulated ?? -Infinity) ? p : best),
    chartData[0],
  );

  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ps-text-primary">Scenario chart</h2>

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
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} iconSize={8} />

            <ReferenceLine
              y={result.baseline.thresholdMw}
              stroke={THRESHOLD_COLOR}
              strokeDasharray="4 4"
              strokeOpacity={0.8}
              label={{
                value: `Threshold ${result.baseline.thresholdMw} MW`,
                position: "right",
                fill: THRESHOLD_COLOR,
                fontSize: 10,
              }}
            />

            <Line
              type="monotone"
              dataKey="Baseline"
              stroke={BASELINE_COLOR}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="Simulated"
              stroke={SIMULATED_COLOR}
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            {baselinePeakPoint?.Baseline != null && (
              <ReferenceDot
                x={baselinePeakPoint.time}
                y={baselinePeakPoint.Baseline}
                r={5}
                fill={BASELINE_COLOR}
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}
            {scenarioPeakPoint?.Simulated != null && (
              <ReferenceDot
                x={scenarioPeakPoint.time}
                y={scenarioPeakPoint.Simulated}
                r={5}
                fill={SIMULATED_COLOR}
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
