import Topbar from "@/components/Topbar";
import PlaceholderPanel from "@/components/PlaceholderPanel";
import { BrainCircuit } from "lucide-react";

export default function ModelIntelligencePage() {
  return (
    <>
      <Topbar title="Model Intelligence" />
      <main className="flex flex-1 flex-col p-6">
        <PlaceholderPanel
          icon={BrainCircuit}
          title="Model intelligence coming soon"
          description="Explainability views into the forecasting model will live here."
        />
      </main>
    </>
  );
}
