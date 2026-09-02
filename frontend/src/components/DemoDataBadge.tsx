import { FlaskConical } from "lucide-react";

export default function DemoDataBadge({ label = "Prototype / demo data" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
      <FlaskConical className="h-3 w-3" />
      {label}
    </span>
  );
}
