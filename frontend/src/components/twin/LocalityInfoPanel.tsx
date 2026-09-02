import { Gauge, Sun, Clock, Thermometer, Home, Building2, ShieldAlert } from "lucide-react";
import type { Locality } from "@/types/locality";
import { riskLevel, demandRatio, RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import DemoDataBadge from "@/components/DemoDataBadge";

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
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

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{locality.name}</h2>
          <p className="text-xs text-slate-500">
            {locality.latitude.toFixed(4)}, {locality.longitude.toFixed(4)}
          </p>
        </div>
        <DemoDataBadge />
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
        <Metric icon={Gauge} label="Current demand" value={`${locality.current_demand_mw} MW`} />
        <Metric
          icon={Gauge}
          label="Demo peak threshold"
          value={`${locality.peak_threshold_mw} MW`}
        />
        <Metric icon={Clock} label="Typical peak time" value={`${locality.typical_peak_hour}:00`} />
        <Metric icon={Home} label="Residential share" value={`${Math.round(locality.residential_share * 100)}%`} />
        <Metric icon={Building2} label="Commercial share" value={`${Math.round(locality.commercial_share * 100)}%`} />
        <Metric icon={Sun} label="Solar capacity" value={`${locality.solar_capacity_mw} MW`} />
        <Metric
          icon={Thermometer}
          label="Cooling sensitivity"
          value={`${Math.round(locality.cooling_sensitivity * 100)}%`}
        />
      </div>

      <p className="text-[11px] leading-relaxed text-slate-600">
        This locality is a prototype zone for the PeakSense hackathon demo and does not
        represent an official electricity-grid boundary. All values above are demo/seeded
        placeholders from the backend, not real utility measurements or ML forecasts. The
        &ldquo;demo peak threshold&rdquo; is a static reference value used to compute the risk
        state above — it is not a model-generated prediction.
      </p>
    </div>
  );
}
