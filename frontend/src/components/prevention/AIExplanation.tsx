import { Lightbulb } from "lucide-react";
import DemoDataBadge from "@/components/DemoDataBadge";

export default function AIExplanation({ explanation }: { explanation: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
          <Lightbulb className="h-4.5 w-4.5" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
              Why is the peak happening?
            </h2>
            <DemoDataBadge label="Demo" />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{explanation}</p>
        </div>
      </div>
    </div>
  );
}
