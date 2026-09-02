import Topbar from "@/components/Topbar";
import PlaceholderPanel from "@/components/PlaceholderPanel";
import { ShieldAlert } from "lucide-react";

export default function PeakPreventionPage() {
  return (
    <>
      <Topbar title="Peak Prevention" />
      <main className="flex flex-1 flex-col p-6">
        <PlaceholderPanel
          icon={ShieldAlert}
          title="Peak prevention tools coming soon"
          description="Recommended actions to prevent grid peaks will appear here."
        />
      </main>
    </>
  );
}
