"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Topbar from "@/components/Topbar";
import PreventionHeader from "@/components/prevention/PreventionHeader";
import PeakRiskOverview from "@/components/prevention/PeakRiskOverview";
import AIExplanation from "@/components/prevention/AIExplanation";
import PeakDrivers from "@/components/prevention/PeakDrivers";
import MitigationRecommendations from "@/components/prevention/MitigationRecommendations";
import PreventionTimeline from "@/components/prevention/PreventionTimeline";
import PeakReductionOpportunity from "@/components/prevention/PeakReductionOpportunity";
import { fetchLocalities } from "@/lib/api";
import { mockPreventionData } from "@/lib/prevention";
import type { Locality } from "@/types/locality";

export default function PeakPreventionPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedLocalityId, setSelectedLocalityId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchLocalities()
      .then((data) => {
        if (cancelled) return;
        setLocalities(data);
        setListState("ready");
        if (data.length > 0) setSelectedLocalityId(data[0].id);
      })
      .catch(() => {
        if (!cancelled) setListState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedLocality = useMemo(
    () => localities.find((l) => l.id === selectedLocalityId) ?? null,
    [localities, selectedLocalityId],
  );

  const prevention = useMemo(
    () => (selectedLocality ? mockPreventionData(selectedLocality) : null),
    [selectedLocality],
  );

  return (
    <>
      <Topbar title="Peak Prevention" />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        {selectedLocality && prevention ? (
          <PreventionHeader
            localities={localities}
            selectedLocalityId={selectedLocality.id}
            onSelectLocality={setSelectedLocalityId}
            peakTime={prevention.peakTime}
            risk={prevention.risk}
          />
        ) : (
          <div>
            <h1 className="text-xl font-semibold text-white">Peak Prevention</h1>
            <p className="mt-1 text-sm text-slate-500">
              Understand the predicted peak and identify actions to reduce grid stress.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            This page uses a local mock prevention adapter for the hackathon prototype — the
            explanation, driver contributions, recommendations, and reduction estimates are
            DEMO/SEEDED, not real model output or validated utility guidance. Peak numbers reuse
            the same forecast adapter as the Forecast page.
          </p>
        </div>

        {listState === "loading" && (
          <p className="text-sm text-slate-500">Loading locality data…</p>
        )}

        {listState === "error" && (
          <p className="text-sm text-red-400">
            Could not reach the backend at the configured API URL. Make sure the FastAPI server
            is running.
          </p>
        )}

        {listState === "ready" && prevention && (
          <>
            <PeakRiskOverview data={prevention} />
            <AIExplanation explanation={prevention.explanation} />
            <PeakDrivers drivers={prevention.drivers} />
            <MitigationRecommendations recommendations={prevention.recommendations} />
            <PreventionTimeline timeline={prevention.timeline} />
            <PeakReductionOpportunity reduction={prevention.reduction} />

            <div className="flex justify-center py-2">
              <Link
                href="/simulator"
                className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                Open What-If Simulator
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}
      </main>
    </>
  );
}
