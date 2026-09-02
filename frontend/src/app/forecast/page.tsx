import Topbar from "@/components/Topbar";
import PlaceholderPanel from "@/components/PlaceholderPanel";
import { TrendingUp } from "lucide-react";

export default function ForecastPage() {
  return (
    <>
      <Topbar title="Forecast" />
      <main className="flex flex-1 flex-col p-6">
        <PlaceholderPanel
          icon={TrendingUp}
          title="Forecast charts coming soon"
          description="Electricity demand forecasts will be visualized here once the forecasting model is built."
        />
      </main>
    </>
  );
}
