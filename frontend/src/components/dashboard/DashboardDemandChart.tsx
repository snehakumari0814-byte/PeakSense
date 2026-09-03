"use client";

import { useMemo, useState, useRef } from "react";
import { Info } from "lucide-react";
import type { ForecastPoint } from "@/types/forecast";

export type ChartDataPoint = {
  time: string;
  hour: number;
  grossDemandMw: number;
  solarGenerationMw: number;
  netDemandMw: number;
};

export default function DashboardDemandChart({
  points,
  scopeName = "Mumbai",
  solarCapacityMw = 15.0,
  loading = false,
}: {
  points: ForecastPoint[] | null;
  scopeName?: string;
  solarCapacityMw?: number;
  loading?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Transform 24h points into Gross, Solar, and Net series
  const data = useMemo<ChartDataPoint[]>(() => {
    if (!points || points.length === 0) return [];

    return points.slice(0, 24).map((p, idx) => {
      const d = new Date(p.timestamp);
      const hour = d.getHours() + d.getMinutes() / 60;
      const net = p.predictedMw ?? p.actualMw ?? 0;

      // Realistic daylight solar bell-curve offset (6 AM to 6 PM)
      let solar = 0;
      if (hour >= 6 && hour <= 18) {
        const irrFrac = Math.sin((Math.PI * (hour - 6)) / 12);
        solar = Math.max(0, solarCapacityMw * irrFrac * 0.85);
      }

      // Gross demand is Net demand + Solar generation
      const gross = net + solar;

      return {
        time: p.time,
        hour: Math.round(hour),
        grossDemandMw: Math.round(gross * 10) / 10,
        solarGenerationMw: Math.round(solar * 10) / 10,
        netDemandMw: Math.round(net * 10) / 10,
      };
    });
  }, [points, solarCapacityMw]);

  // Dimensions & bounds
  const width = 640;
  const height = 320;
  const padLeft = 55;
  const padRight = 25;
  const padTop = 25;
  const padBottom = 40;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxVal = useMemo(() => {
    if (data.length === 0) return 4000;
    const max = Math.max(...data.map((d) => d.grossDemandMw));
    return Math.ceil((max * 1.15) / 500) * 500;
  }, [data]);

  const yTicks = useMemo(() => {
    const step = maxVal <= 1000 ? 200 : maxVal <= 2500 ? 500 : 1000;
    const ticks: number[] = [];
    for (let v = 0; v <= maxVal; v += step) {
      ticks.push(v);
    }
    return ticks;
  }, [maxVal]);

  function getX(idx: number): number {
    if (data.length <= 1) return padLeft;
    return padLeft + (idx / (data.length - 1)) * chartW;
  }

  function getY(val: number): number {
    return padTop + chartH - (val / maxVal) * chartH;
  }

  // Smooth bezier curve generator
  function makeSmoothPath(values: number[]): string {
    if (values.length === 0) return "";
    const pts = values.map((v, i) => ({ x: getX(i), y: getY(v) }));
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const grossPath = useMemo(
    () => makeSmoothPath(data.map((d) => d.grossDemandMw)),
    [data, maxVal],
  );
  const solarPath = useMemo(
    () => makeSmoothPath(data.map((d) => d.solarGenerationMw)),
    [data, maxVal],
  );
  const netPath = useMemo(
    () => makeSmoothPath(data.map((d) => d.netDemandMw)),
    [data, maxVal],
  );

  // Key x-axis sample indices for clean label intervals (e.g. 12 AM, 3 AM, 6 AM...)
  const xLabelIndices = useMemo(() => {
    if (data.length === 0) return [];
    const step = Math.max(1, Math.floor(data.length / 8));
    const indices: number[] = [];
    for (let i = 0; i < data.length; i += step) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== data.length - 1) {
      indices.push(data.length - 1);
    }
    return indices;
  }, [data]);

  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-6 shadow-2xs">
      {/* Chart Header & Legend */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            Demand vs Solar vs Net Grid Demand ({scopeName})
          </h2>
          <div className="group relative">
            <Info className="h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-600" />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 w-64 rounded-lg border border-slate-200 bg-slate-900 p-2.5 text-center text-[11px] text-white shadow-xl group-hover:block">
              Shows 24h total demand load, rooftop solar generation offset, and net demand on the grid.
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span>Gross Demand</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span>Solar Generation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Net Grid Demand</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative mt-4 flex-1">
        {loading || data.length === 0 ? (
          <div className="flex h-72 w-full items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
            Loading 24h demand curves…
          </div>
        ) : (
          <div className="relative w-full">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              className="h-auto w-full overflow-visible"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Unit Tag */}
              <text
                x={padLeft - 10}
                y={padTop - 8}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-semibold font-mono"
              >
                MW
              </text>

              {/* Horizontal Gridlines & Y-Axis Labels */}
              {yTicks.map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={width - padRight}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-medium"
                    >
                      {tick.toLocaleString()}
                    </text>
                  </g>
                );
              })}

              {/* Series Paths */}
              {/* 1. Solar Generation (Amber) */}
              <path
                d={solarPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              {/* 2. Gross Demand (Blue) */}
              <path
                d={grossPath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              {/* 3. Net Grid Demand (Emerald Green) */}
              <path
                d={netPath}
                fill="none"
                stroke="#10b981"
                strokeWidth={2.5}
                strokeLinecap="round"
              />

              {/* Individual Dots on Lines */}
              {data.map((d, i) => (
                <g key={i}>
                  <circle
                    cx={getX(i)}
                    cy={getY(d.solarGenerationMw)}
                    r={hoveredIdx === i ? 4 : 2.5}
                    className="fill-amber-400 transition-transform"
                  />
                  <circle
                    cx={getX(i)}
                    cy={getY(d.grossDemandMw)}
                    r={hoveredIdx === i ? 4 : 2.5}
                    className="fill-blue-500 transition-transform"
                  />
                  <circle
                    cx={getX(i)}
                    cy={getY(d.netDemandMw)}
                    r={hoveredIdx === i ? 4 : 2.5}
                    className="fill-emerald-500 transition-transform"
                  />
                </g>
              ))}

              {/* X-Axis Labels */}
              {xLabelIndices.map((idx) => {
                const d = data[idx];
                const x = getX(idx);
                return (
                  <text
                    key={idx}
                    x={x}
                    y={height - padBottom + 18}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px] font-medium"
                  >
                    {d.time}
                  </text>
                );
              })}

              {/* Interactive Hover Crosshair */}
              {hoveredIdx !== null && activePoint && (
                <g>
                  <line
                    x1={getX(hoveredIdx)}
                    y1={padTop}
                    x2={getX(hoveredIdx)}
                    y2={height - padBottom}
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                </g>
              )}

              {/* Invisible Full-Height Hover Rects for Hit-Testing */}
              {data.map((_, i) => {
                const xPrev = i === 0 ? padLeft : (getX(i - 1) + getX(i)) / 2;
                const xNext =
                  i === data.length - 1
                    ? width - padRight
                    : (getX(i) + getX(i + 1)) / 2;
                return (
                  <rect
                    key={i}
                    x={xPrev}
                    y={padTop}
                    width={xNext - xPrev}
                    height={chartH}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                  />
                );
              })}
            </svg>

            {/* Floating Tooltip */}
            {hoveredIdx !== null && activePoint && (
              <div
                className="pointer-events-none absolute top-2 z-30 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-xs"
                style={{
                  left: `${(getX(hoveredIdx) / width) * 100}%`,
                }}
              >
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1 mb-1.5">
                  {activePoint.time}
                </p>
                <div className="flex flex-col gap-1 text-[11px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                      <span className="h-2 w-2 rounded-full bg-blue-500" /> Gross
                    </span>
                    <span className="font-bold text-slate-900">
                      {activePoint.grossDemandMw.toFixed(1)} MW
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                      <span className="h-2 w-2 rounded-full bg-amber-400" /> Solar
                    </span>
                    <span className="font-bold text-slate-900">
                      {activePoint.solarGenerationMw.toFixed(1)} MW
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Net Grid
                    </span>
                    <span className="font-bold text-slate-900">
                      {activePoint.netDemandMw.toFixed(1)} MW
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
