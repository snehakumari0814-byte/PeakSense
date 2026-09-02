import type { LucideIcon } from "lucide-react";

export default function PlaceholderPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/60 text-emerald-400">
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
    </div>
  );
}
