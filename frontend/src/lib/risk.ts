/**
 * Peak-risk classification derived from locality demand data.
 *
 * Risk is ALWAYS computed from `current_demand_mw` / `peak_threshold_mw` —
 * it must never be hardcoded per locality independently of that data.
 */

import type { Locality } from "@/types/locality";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const RISK_THRESHOLDS = {
  LOW: 0.6,
  MEDIUM: 0.8,
  HIGH: 1.0,
} as const;

export function demandRatio(locality: Locality): number {
  if (locality.peak_threshold_mw <= 0) return 0;
  return locality.current_demand_mw / locality.peak_threshold_mw;
}

export function riskLevel(locality: Locality): RiskLevel {
  const ratio = demandRatio(locality);
  if (ratio < RISK_THRESHOLDS.LOW) return "LOW";
  if (ratio < RISK_THRESHOLDS.MEDIUM) return "MEDIUM";
  if (ratio < RISK_THRESHOLDS.HIGH) return "HIGH";
  return "CRITICAL";
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "#34d399",
  MEDIUM: "#facc15",
  HIGH: "#fb923c",
  CRITICAL: "#f87171",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};
