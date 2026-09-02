"use client";

import { Plus, Minus, Compass } from "lucide-react";

export default function ViewportControls({
  onZoomIn,
  onZoomOut,
  onResetOrientation,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetOrientation: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute right-4 top-16 flex flex-col items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/85 p-1.5 backdrop-blur-sm">
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Zoom in"
        className="flex h-7 w-7 items-center justify-center rounded text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
      >
        <Plus className="h-4 w-4" />
      </button>
      <div className="h-px w-6 bg-slate-800" />
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Zoom out"
        className="flex h-7 w-7 items-center justify-center rounded text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="h-px w-6 bg-slate-800" />
      <button
        type="button"
        onClick={onResetOrientation}
        aria-label="Reset orientation"
        className="flex h-7 w-7 items-center justify-center rounded text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
      >
        <Compass className="h-4 w-4" />
      </button>
      <div className="mt-1 rounded-full border border-slate-700 bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
        3D
      </div>
    </div>
  );
}
