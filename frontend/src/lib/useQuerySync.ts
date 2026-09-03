"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Reads/writes the shared `locality` and `date` query parameters so
 * selection persists across Forecast, Peak Prevention, and the Simulator
 * without a global store or localStorage. `router.replace` (not `push`) is
 * used so changing locality/date doesn't spam browser history.
 *
 * Each page reads `initialLocality`/`initialDate` exactly once (via a lazy
 * `useState` initializer at the call site) and thereafter owns its own
 * state, pushing changes back out with `setParams` — one-directional after
 * mount, so this never fights the page's own state updates.
 */
export function useQuerySync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return {
    initialLocality: searchParams.get("locality"),
    initialDate: searchParams.get("date"),
    setParams,
  };
}
