import Link from "next/link";
import { Gauge, Sun, Clock, Thermometer, Home, Building2, ShieldAlert, ArrowRight } from "lucide-react";
import type { Locality } from "@/types/locality";
import { riskLevel, demandRatio, RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import DemoDataBadge from "@/components/DemoDataBadge";

type MetricRow = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
};

/**
 * Metric rows are built from a plain config list keyed off the current
 * `Locality` shape. When the backend later adds forecasting fields
 * (forecast_1hour_mw, peak_time, probability, confidence, etc.), extend
 * this list — the layout and the rest of the panel don't need to change.
 */
function buildMetrics(locality: Locality): MetricRow[] {
  return [
    { key: "demand", icon: Gauge, label: "Current demand", value: `${locality.current_demand_mw} MW` },
    {
      key: "threshold",
      icon: Gauge,
      label: "Demo peak threshold",
      value: `${locality.peak_threshold_mw} MW`,
    },
    { key: "peak-time", icon: Clock, label: "Typical peak time", value: `${locality.typical_peak_hour}:00` },
    {
      key: "residential",
      icon: Home,
      label: "Residential share",
      value: `${Math.round(locality.residential_share * 100)}%`,
    },
    {
      key: "commercial",
      icon: Building2,
      label: "Commercial share",
      value: `${Math.round(locality.commercial_share * 100)}%`,
    },
    { key: "solar", icon: Sun, label: "Solar capacity", value: `${locality.solar_capacity_mw} MW` },
    {
      key: "cooling",
      icon: Thermometer,
      label: "Cooling sensitivity",
      value: `${Math.round(locality.cooling_sensitivity * 100)}%`,
    },
  ];
}

function Metric({ icon: Icon, label, value }: Omit<MetricRow, "key">) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
      <span className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

export default function LocalityInfoPanel({ locality }: { locality: Locality }) {
  const risk = riskLevel(locality);
  const ratio = demandRatio(locality);
  const riskColor = RISK_COLORS[risk];
  const metrics = buildMetrics(locality);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{locality.name}</h2>
          <p className="text-xs text-slate-500">
            {locality.latitude.toFixed(4)}, {locality.longitude.toFixed(4)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={{
              borderColor: `${riskColor}4d`,
              backgroundColor: `${riskColor}1a`,
              color: riskColor,
            }}
          >
            {RISK_LABELS[risk]}
          </span>
          <DemoDataBadge />
        </div>
      </div>

      <div
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium"
        style={{
          borderColor: `${riskColor}4d`,
          backgroundColor: `${riskColor}1a`,
          color: riskColor,
        }}
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        Peak risk: {RISK_LABELS[risk]} ({Math.round(ratio * 100)}% of demo threshold)
      </div>

      <div className="grid grid-cols-1 gap-2">
        {metrics.map((metric) => (
          <Metric key={metric.key} icon={metric.icon} label={metric.label} value={metric.value} />
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-600">
        This locality is a prototype zone for the PeakSense hackathon demo and does not
        represent an official electricity-grid boundary. All values above are demo/seeded
        placeholders from the backend, not real utility measurements or ML forecasts. The
        &ldquo;demo peak threshold&rdquo; is a static reference value used to compute the risk
        state above — it is not a model-generated prediction.
      </p>

      <Link
        href="/forecast"
        className="mt-auto flex items-center justify-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
      >
        View Forecast
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
