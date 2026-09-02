"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AlertTriangle, Compass } from "lucide-react";
import Topbar from "@/components/Topbar";
import LocalityInfoPanel from "@/components/twin/LocalityInfoPanel";
import { fetchLocalities, fetchLocality } from "@/lib/api";
import type { Locality } from "@/types/locality";

const MumbaiDigitalTwin = dynamic(
  () => import("@/components/twin/MumbaiDigitalTwin"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-500">
        Loading 3D Digital Twin…
      </div>
    ),
  },
);

export default function DigitalTwinPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLocality, setSelectedLocality] = useState<Locality | null>(null);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [detailError, setDetailError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchLocalities()
      .then((data) => {
        if (cancelled) return;
        setLocalities(data);
        setListState("ready");
      })
      .catch(() => {
        if (!cancelled) setListState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedLocality(null);
      return;
    }
    let cancelled = false;
    setDetailError(false);

    fetchLocality(selectedId)
      .then((data) => {
        if (!cancelled) setSelectedLocality(data);
      })
      .catch(() => {
        if (!cancelled) setDetailError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return (
    <>
      <Topbar title="Mumbai Digital Twin" />
      <main className="flex flex-1 flex-col gap-3 overflow-hidden p-6">
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            This 3D twin represents prototype locality zones for the PeakSense hackathon demo —
            not official electricity-grid boundaries or real-world building geometry. All demand,
            risk, and capacity values are DEMO/SEEDED placeholders served by the backend.
          </p>
        </div>

        {listState === "loading" && (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            Loading Mumbai locality data…
          </div>
        )}

        {listState === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-red-400">
            <p>Could not reach the backend at the configured API URL.</p>
            <p className="text-xs text-slate-500">
              Make sure the FastAPI server is running on port 8000.
            </p>
          </div>
        )}

        {listState === "ready" && (
          <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="flex-1">
              <MumbaiDigitalTwin
                localities={localities}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReset={() => setSelectedId(null)}
              />
            </div>

            <div className="w-80 shrink-0">
              {detailError && (
                <p className="text-sm text-red-400">Could not load the selected locality profile.</p>
              )}

              {!detailError && selectedLocality && <LocalityInfoPanel locality={selectedLocality} />}

              {!detailError && !selectedLocality && (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-6 text-center text-sm text-slate-500">
                  <Compass className="h-5 w-5" />
                  Click a locality zone in the 3D twin to view its profile
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
