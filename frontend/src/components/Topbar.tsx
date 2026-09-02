"use client";

import { useEffect, useState } from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";

type HealthStatus = "checking" | "online" | "offline";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function Topbar({ title }: { title: string }) {
  const [status, setStatus] = useState<HealthStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        if (!cancelled) setStatus(res.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Activity className="h-4 w-4 text-emerald-400" />
          Live grid overview
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            status === "online"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : status === "offline"
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-slate-700 bg-slate-800/50 text-slate-400"
          }`}
        >
          {status === "online" ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {status === "checking"
            ? "Checking backend..."
            : status === "online"
              ? "Backend online"
              : "Backend offline"}
        </div>
      </div>
    </header>
  );
}
