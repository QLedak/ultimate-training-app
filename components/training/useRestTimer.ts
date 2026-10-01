"use client";

import { useEffect, useState } from "react";
import {
  readRestTimer,
  RestTimerState,
  REST_TIMER_EVENT_NAME,
  REST_TIMER_STORAGE_KEY,
} from "@/lib/training/rest-timer-store";

/**
 * Subscribes to the global rest timer (lib/training/rest-timer-store.ts) and
 * re-renders every second while one is running, from any page. Listens for
 * the store's own custom event (same-tab updates — storage events don't fire
 * in the tab that made the change) and the native `storage` event (a second
 * tab/window changing it), plus a 1s interval purely to tick the displayed
 * countdown down — the underlying value is always recomputed from the
 * stored end timestamp, never decremented in place, so it can't drift.
 */
export function useRestTimer(): { state: RestTimerState | null; secondsLeft: number | null } {
  const [state, setState] = useState<RestTimerState | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    function sync() {
      setState(readRestTimer());
    }
    sync();

    const onStorage = (e: StorageEvent) => {
      if (e.key === REST_TIMER_STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener(REST_TIMER_EVENT_NAME, sync);
    window.addEventListener("storage", onStorage);
    const tick = setInterval(() => {
      sync();
      forceTick((n) => n + 1);
    }, 1000);

    return () => {
      window.removeEventListener(REST_TIMER_EVENT_NAME, sync);
      window.removeEventListener("storage", onStorage);
      clearInterval(tick);
    };
  }, []);

  if (!state) return { state: null, secondsLeft: null };
  const secondsLeft = Math.max(0, Math.round((state.endsAt - Date.now()) / 1000));
  return { state, secondsLeft };
}
