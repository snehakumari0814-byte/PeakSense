import Topbar from "@/components/Topbar";
import StatCard from "@/components/StatCard";
import PlaceholderPanel from "@/components/PlaceholderPanel";
import { Gauge, TrendingUp, ShieldAlert, MapPinned, LineChart } from "lucide-react";

export default function DashboardPage() {
  return (
    <>
      <Topbar title="GridPulse Dashboard" />
      <main className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Current Load" value="—" hint="No data source connected" icon={Gauge} />
          <StatCard label="Forecast Peak" value="—" hint="Forecast engine not yet active" icon={TrendingUp} />
          <StatCard label="Risk Level" value="—" hint="Peak prevention offline" icon={ShieldAlert} />
          <StatCard label="Zones Monitored" value="—" hint="Digital twin not yet connected" icon={MapPinned} />
        </div>

        <PlaceholderPanel
          icon={LineChart}
          title="Demand chart coming soon"
          description="This panel will chart Mumbai's real-time and forecasted electricity demand once the forecasting engine is connected."
        />
      </main>
    </>
  );
}
