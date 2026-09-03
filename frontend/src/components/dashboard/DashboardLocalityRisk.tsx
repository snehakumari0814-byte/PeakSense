"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Minus, RotateCcw } from "lucide-react";
import type { Locality } from "@/types/locality";
import type { ForecastResponse } from "@/types/forecast";
import { RISK_COLORS, RISK_LABELS, riskLevel, type RiskLevel } from "@/lib/risk";

// Coordinated 2D stylized polygon coordinates for Mumbai's 10 localities
type LocalityZone2D = {
  id: string;
  name: string;
  points: string;
  labelX: number;
  labelY: number;
};

const MUMBAI_ZONES: LocalityZone2D[] = [
  {
    id: "borivali",
    name: "Borivali",
    points: "160,30 220,35 240,80 180,85 150,70",
    labelX: 195,
    labelY: 60,
  },
  {
    id: "goregaon",
    name: "Goregaon",
    points: "140,75 180,85 180,135 125,125",
    labelX: 150,
    labelY: 105,
  },
  {
    id: "thane",
    name: "Thane",
    points: "240,75 285,85 280,140 235,130",
    labelX: 260,
    labelY: 110,
  },
  {
    id: "mulund",
    name: "Mulund",
    points: "220,135 275,140 265,190 215,180",
    labelX: 245,
    labelY: 165,
  },
  {
    id: "andheri",
    name: "Andheri",
    points: "125,130 185,140 180,195 115,185",
    labelX: 150,
    labelY: 165,
  },
  {
    id: "powai",
    name: "Powai",
    points: "185,140 225,135 260,190 180,195",
    labelX: 215,
    labelY: 175,
  },
  {
    id: "kurla",
    name: "Kurla",
    points: "175,200 255,195 245,255 170,250",
    labelX: 210,
    labelY: 230,
  },
  {
    id: "bandra",
    name: "Bandra",
    points: "115,190 175,200 165,260 110,245",
    labelX: 140,
    labelY: 228,
  },
  {
    id: "dadar",
    name: "Dadar",
    points: "110,250 165,265 155,315 105,300",
    labelX: 135,
    labelY: 290,
  },
  {
    id: "lower_parel",
    name: "Lower Parel",
    points: "105,305 155,320 145,365 95,350",
    labelX: 125,
    labelY: 340,
  },
  {
    id: "colaba",
    name: "Colaba",
    points: "95,355 140,370 120,440 80,410",
    labelX: 105,
    labelY: 395,
  },
];

export default function DashboardLocalityRisk({
  localities,
  forecasts,
  selectedLocalityId,
  onSelectLocality,
}: {
  localities: Locality[];
  forecasts: Record<string, ForecastResponse>;
  selectedLocalityId: string | "all";
  onSelectLocality: (id: string | "all") => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Helper to get real risk for a locality
  function getLocalityRisk(locId: string): RiskLevel {
    const fc = forecasts[locId];
    if (fc?.peakAnalysis?.risk) return fc.peakAnalysis.risk;
    const loc = localities.find((l) => l.id === locId);
    return loc ? riskLevel(loc) : "LOW";
  }

  const hoveredLocality = hoveredId
    ? localities.find((l) => l.id === hoveredId) ?? null
    : null;
  const hoveredForecast = hoveredId ? forecasts[hoveredId] ?? null : null;

  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-6 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-slate-900">
          Mumbai Locality Risk
        </h2>
        <Link
          href="/digital-twin"
          className="flex items-center gap-1 text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
        >
          <span>View Digital Twin</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* 2D Stylized Map Canvas */}
      <div className="relative my-2 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-slate-50/60 p-2">
        <svg
          viewBox="40 10 280 440"
          className="h-80 w-auto max-w-full drop-shadow-xs transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {/* Subtle coastline shadow backdrop */}
          <path
            d="M 140,20 Q 250,25 290,90 Q 280,200 260,260 Q 180,310 145,370 Q 120,450 75,410 Q 90,300 105,200 Q 120,90 140,20 Z"
            fill="#e2e8f0"
            opacity="0.4"
          />

          {/* Locality Polygon Zones */}
          {MUMBAI_ZONES.map((zone) => {
            const risk = getLocalityRisk(zone.id);
            const isSelected = selectedLocalityId === zone.id;
            const isHovered = hoveredId === zone.id;
            const fillColor = RISK_COLORS[risk];

            return (
              <g key={zone.id} className="cursor-pointer">
                <polygon
                  points={zone.points}
                  fill={fillColor}
                  fillOpacity={isSelected ? 0.95 : isHovered ? 0.85 : 0.72}
                  stroke={isSelected ? "#0f172a" : isHovered ? "#334155" : "#ffffff"}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className="transition-all duration-150"
                  onMouseEnter={() => setHoveredId(zone.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() =>
                    onSelectLocality(selectedLocalityId === zone.id ? "all" : zone.id)
                  }
                />
                <text
                  x={zone.labelX}
                  y={zone.labelY}
                  textAnchor="middle"
                  className="pointer-events-none fill-slate-800 text-[10px] font-bold tracking-tight select-none"
                  style={{ textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}
                >
                  {zone.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Locality Quick Tooltip */}
        {hoveredLocality && (
          <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border border-slate-200 bg-white/95 p-2.5 text-xs shadow-md backdrop-blur-xs">
            <p className="font-bold text-slate-900">{hoveredLocality.name}</p>
            <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-slate-600">
              <p>
                Demand:{" "}
                <span className="font-semibold text-slate-900">
                  {(
                    hoveredForecast?.summary?.currentLoadMw ??
                    hoveredLocality.current_demand_mw
                  ).toFixed(1)}{" "}
                  MW
                </span>
              </p>
              <p>
                Pred. Peak:{" "}
                <span className="font-semibold text-blue-600">
                  {(
                    hoveredForecast?.peakAnalysis?.predictedPeakMw ??
                    hoveredLocality.current_demand_mw
                  ).toFixed(1)}{" "}
                  MW
                </span>
              </p>
              <p>
                Risk:{" "}
                <span
                  className="font-bold"
                  style={{ color: RISK_COLORS[getLocalityRisk(hoveredLocality.id)] }}
                >
                  {RISK_LABELS[getLocalityRisk(hoveredLocality.id)]}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Map Zoom & Reset Controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.15))}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              onSelectLocality("all");
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
            title="Reset overview"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-slate-200/80 bg-white/90 p-2 text-[10px] font-semibold text-slate-700 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK_COLORS.CRITICAL }} />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK_COLORS.HIGH }} />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK_COLORS.MEDIUM }} />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK_COLORS.LOW }} />
            <span>Low</span>
          </div>
        </div>
      </div>
    </div>
  );
}
