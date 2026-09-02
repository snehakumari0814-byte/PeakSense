import type { ModelAccuracy as ModelAccuracyData } from "@/types/forecast";
import { HORIZON_LABELS, FORECAST_HORIZONS } from "@/types/forecast";
import DemoDataBadge from "@/components/DemoDataBadge";

export default function ModelAccuracy({ accuracy }: { accuracy: ModelAccuracyData }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Model Accuracy</h2>
        <DemoDataBadge label="Demo" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FORECAST_HORIZONS.map((h) => {
          const metric = accuracy[h];
          return (
            <div key={h} className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {HORIZON_LABELS[h]}
              </p>
              <dl className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">MAE</dt>
                  <dd className="font-medium text-white">{metric.maeMw} MW</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">RMSE</dt>
                  <dd className="font-medium text-white">{metric.rmseMw} MW</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">MAPE</dt>
                  <dd className="font-medium text-white">{metric.mapePct}%</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        Demo accuracy figures only — not measured against real model predictions. Will be
        replaced by <code className="text-slate-500">GET /api/model-metrics</code> once the
        forecasting model exists.
      </p>
    </div>
  );
}
