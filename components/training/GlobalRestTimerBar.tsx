"use client";

import Link from "next/link";
import { useRestTimer } from "./useRestTimer";
import { adjustRestTimer, clearRestTimer } from "@/lib/training/rest-timer-store";

/**
 * Mounted once in the root layout (app/layout.tsx) so a rest timer started
 * on the logging screen keeps showing — and keeps counting down accurately,
 * since it reads the same stored end-timestamp — no matter what page the
 * athlete navigates to while resting (testing feedback: "rest timer should
 * still run even if navigating away from the page"). Tapping it returns to
 * the workout that started it.
 */
export function GlobalRestTimerBar() {
  const { state, secondsLeft } = useRestTimer();

  if (!state || secondsLeft == null) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isDone = secondsLeft <= 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t border-brand bg-brand-dark px-4 py-2.5 text-white shadow-lg">
      <Link href={`/app/log/${state.sessionId}`} className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-blue-200">
          {isDone ? "Rest complete" : "Resting"} · {state.exerciseName}
        </p>
        <p className="text-lg font-bold tabular-nums">
          {minutes}:{String(seconds).padStart(2, "0")}
        </p>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => adjustRestTimer(15)}
          className="rounded-md border border-white/30 px-2.5 py-1.5 text-xs font-medium hover:bg-white/10"
        >
          +15s
        </button>
        <button
          type="button"
          onClick={() => clearRestTimer()}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-brand-dark hover:bg-blue-50"
        >
          {isDone ? "Dismiss" : "Skip"}
        </button>
      </div>
    </div>
  );
}
