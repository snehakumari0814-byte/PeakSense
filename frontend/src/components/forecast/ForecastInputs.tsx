import { Thermometer, Droplets, Clock, CalendarDays, PartyPopper, History, Sun } from "lucide-react";
import type { ForecastInputs as ForecastInputsData } from "@/types/forecast";
import DemoDataBadge from "@/components/DemoDataBadge";

function Field({
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

export default function ForecastInputs({ inputs }: { inputs: ForecastInputsData }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Forecast Inputs</h2>
        <DemoDataBadge label="Demo" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field icon={Thermometer} label="Temperature" value={`${inputs.temperatureC}°C`} />
        <Field icon={Droplets} label="Humidity" value={`${inputs.humidityPct}%`} />
        <Field icon={Clock} label="Hour" value={inputs.hour} />
        <Field icon={CalendarDays} label="Day" value={inputs.day} />
        <Field icon={PartyPopper} label="Holiday" value={inputs.isHoliday ? "Yes" : "No"} />
        <Field icon={History} label="Previous demand" value={`${inputs.previousDemandMw} MW`} />
        <Field icon={Sun} label="Solar generation" value={`${inputs.solarGenerationMw} MW`} />
      </div>

      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
        These are UI placeholders until the ML backend supplies real weather, calendar, and
        historical features.
      </p>
    </div>
  );
}
