import { FlaskConical, Radio, AlertTriangle } from "lucide-react";

export type BadgeVariant = "demo" | "live" | "fallback";

export default function DemoDataBadge({
  label,
  variant = "demo",
}: {
  label?: string;
  variant?: BadgeVariant;
}) {
  if (variant === "live") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
        <Radio className="h-3 w-3 animate-pulse" />
        {label ?? "Live Model"}
      </span>
    );
  }

  if (variant === "fallback") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
        <AlertTriangle className="h-3 w-3" />
        {label ?? "Demo Fallback"}
      </span>
    );
  }

  // default: demo
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
      <FlaskConical className="h-3 w-3" />
      {label ?? "Prototype / demo data"}
    </span>
  );
}
