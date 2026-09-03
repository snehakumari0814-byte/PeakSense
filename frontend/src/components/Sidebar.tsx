"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Zap, Sun, ChevronDown } from "lucide-react";
import { navItems } from "@/lib/nav";

// Routes that share locality/date selection — the query string is carried
// across navigation between them so Forecast → Peak Prevention → Simulator
// feels like one coherent view instead of independent pages.
const DATE_AWARE_ROUTES = new Set(["/forecast", "/peak-prevention", "/simulator"]);

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const carryQuery = DATE_AWARE_ROUTES.has(pathname) && searchParams.toString().length > 0;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white shadow-[1px_0_4px_rgba(0,0,0,0.02)]">
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Zap className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-bold tracking-tight text-slate-900">GridPulse</p>
          <p className="text-[11px] font-medium text-slate-400">Mumbai Energy Intelligence</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 px-3 py-5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const href =
            carryQuery && DATE_AWARE_ROUTES.has(item.href)
              ? `${item.href}?${searchParams.toString()}`
              : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-emerald-50/90 text-emerald-800 font-semibold shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? "text-emerald-700" : "text-slate-400"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Theme selector footer */}
      <div className="border-t border-slate-100 p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <span className="flex items-center gap-2">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            Light Mode
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>
    </aside>
  );
}
