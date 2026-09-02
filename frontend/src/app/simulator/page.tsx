import Topbar from "@/components/Topbar";
import PlaceholderPanel from "@/components/PlaceholderPanel";
import { FlaskConical } from "lucide-react";

export default function SimulatorPage() {
  return (
    <>
      <Topbar title="What-If Simulator" />
      <main className="flex flex-1 flex-col p-6">
        <PlaceholderPanel
          icon={FlaskConical}
          title="What-if simulator coming soon"
          description="Scenario simulation controls will be built here."
        />
      </main>
    </>
  );
}
