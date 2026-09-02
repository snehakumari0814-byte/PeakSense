"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Topbar from "@/components/Topbar";
import SimulatorHeader from "@/components/simulator/SimulatorHeader";
import BaselinePeak from "@/components/simulator/BaselinePeak";
import InterventionControls from "@/components/simulator/InterventionControls";
import ScenarioChart from "@/components/simulator/ScenarioChart";
import ScenarioResult from "@/components/simulator/ScenarioResult";
import InterventionSummary from "@/components/simulator/InterventionSummary";
import { fetchLocalities } from "@/lib/api";
import { simulateScenario } from "@/lib/simulator";
import { DEFAULT_INTERVENTIONS, type InterventionSettings } from "@/types/simulator";
import type { Locality } from "@/types/locality";

const CALCULATION_DELAY_MS = 500;

export default function SimulatorPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedLocalityId, setSelectedLocalityId] = useState<string | null>(null);

  const [pendingSettings, setPendingSettings] = useState<InterventionSettings>(DEFAULT_INTERVENTIONS);
  const [appliedSettings, setAppliedSettings] = useState<InterventionSettings>(DEFAULT_INTERVENTIONS);
  const [isCalculating, setIsCalculating] = useState(false);

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

  const result = useMemo(
    () => (selectedLocality ? simulateScenario(selectedLocality, appliedSettings) : null),
    [selectedLocality, appliedSettings],
  );

  const isDirty = useMemo(
    () => JSON.stringify(pendingSettings) !== JSON.stringify(appliedSettings),
    [pendingSettings, appliedSettings],
  );

  function handleSliderChange(key: keyof InterventionSettings, valuePct: number) {
    setPendingSettings((prev) => ({ ...prev, [key]: valuePct / 100 }));
  }

  function handleRun() {
    setIsCalculating(true);
    setTimeout(() => {
      setAppliedSettings(pendingSettings);
      setIsCalculating(false);
    }, CALCULATION_DELAY_MS);
  }

  function handleReset() {
    setPendingSettings(DEFAULT_INTERVENTIONS);
    setAppliedSettings(DEFAULT_INTERVENTIONS);
  }

  function handleSelectLocality(id: string) {
    setSelectedLocalityId(id);
    setPendingSettings(DEFAULT_INTERVENTIONS);
    setAppliedSettings(DEFAULT_INTERVENTIONS);
  }

  return (
    <>
      <Topbar title="What-If Simulator" />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        {selectedLocality ? (
          <SimulatorHeader
            localities={localities}
            selectedLocalityId={selectedLocality.id}
            onSelectLocality={handleSelectLocality}
          />
        ) : (
          <div>
            <h1 className="text-xl font-semibold text-white">What-If Simulator</h1>
            <p className="mt-1 text-sm text-slate-500">
              Test demand-response interventions before the predicted peak.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            This is a demand-response scenario simulator, not a physical electrical-grid
            simulator. The baseline forecast reuses the same mock adapter as the Forecast and
            Peak Prevention pages; intervention results are DEMO/SEEDED prototype estimates.
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

        {listState === "ready" && result && (
          <>
            <BaselinePeak baseline={result.baseline} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <InterventionControls
                  settings={pendingSettings}
                  onChange={handleSliderChange}
                  onRun={handleRun}
                  onReset={handleReset}
                  isCalculating={isCalculating}
                  isDirty={isDirty}
                />
              </div>
              <div className="lg:col-span-2">
                <ScenarioResult result={result} />
              </div>
            </div>

            <ScenarioChart result={result} />

            <InterventionSummary breakdown={result.breakdown} totalReductionMw={result.reductionMw} />
          </>
        )}
      </main>
    </>
  );
}
