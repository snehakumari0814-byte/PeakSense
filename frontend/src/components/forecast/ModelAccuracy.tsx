import type { ModelAccuracy as ModelAccuracyData } from "@/types/forecast";
import { HORIZON_LABELS, FORECAST_HORIZONS } from "@/types/forecast";

export default function ModelAccuracy({
  accuracy,
  isLive,
}: {
  accuracy: ModelAccuracyData;
  isLive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ps-text-primary">Model accuracy</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FORECAST_HORIZONS.map((h) => {
          const metric = accuracy[h];
          return (
            <div key={h} className="rounded-md border border-ps-border bg-ps-background p-3">
              <p className="mb-2 text-xs font-medium text-ps-text-muted">
                {HORIZON_LABELS[h]}
              </p>
              <dl className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-ps-text-secondary">MAE</dt>
                  <dd className="font-medium text-ps-text-primary">
                    {metric.maeMw > 0 ? `${metric.maeMw.toFixed(1)} MW` : "N/A"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ps-text-secondary">RMSE</dt>
                  <dd className="font-medium text-ps-text-primary">
                    {metric.rmseMw > 0 ? `${metric.rmseMw.toFixed(1)} MW` : "N/A"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ps-text-secondary">MAPE</dt>
                  <dd className="font-medium text-ps-text-primary">
                    {metric.mapePct > 0 ? `${metric.mapePct.toFixed(2)}%` : "N/A"}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ps-text-muted">
        {isLive
          ? "Measured against held-out validation data, city-wide Mumbai bulk demand (MW)."
          : "Backend offline — figures shown are local placeholders, not measured accuracy."}
      </p>
    </div>
  );
}
