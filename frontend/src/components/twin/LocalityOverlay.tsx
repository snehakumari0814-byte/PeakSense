"use client";

import { Html } from "@react-three/drei";
import { RISK_LABELS, type RiskLevel } from "@/lib/risk";

/**
 * Floating label anchored above a locality zone in 3D space.
 */
export default function LocalityOverlay({
  name,
  risk,
  color,
  selected,
  showRisk,
}: {
  name: string;
  risk: RiskLevel;
  color: string;
  selected: boolean;
  showRisk: boolean;
}) {
  return (
    <Html center distanceFactor={38} occlude={false} zIndexRange={[10, 0]}>
      <div
        className={`pointer-events-none flex flex-col items-center gap-0.5 whitespace-nowrap rounded-md border px-2 py-1 text-center backdrop-blur-sm transition-opacity ${
          selected
            ? "border-emerald-400/50 bg-slate-950/90"
            : "border-slate-700/60 bg-slate-950/70"
        }`}
      >
        <span className="text-[11px] font-medium text-white">{name}</span>
        {showRisk && (
          <span className="flex items-center gap-1 text-[9px] font-medium" style={{ color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            {RISK_LABELS[risk]}
          </span>
        )}
      </div>
    </Html>
  );
}
