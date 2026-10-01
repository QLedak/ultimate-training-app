/**
 * App-wide rest timer, backed by localStorage instead of component state.
 *
 * Testing feedback: the rest timer used to live entirely in the guided
 * workout's React state (a setTimeout-driven countdown), which meant
 * navigating to any other page — even just tapping "Back" to check the
 * schedule — threw the running timer away, since Next.js unmounts the page
 * component on client-side navigation. Storing the timer's end time (an
 * absolute timestamp, not a ticking counter) in localStorage instead means
 * any page, including a `GlobalRestTimerBar` mounted in the root layout, can
 * independently compute "how much is left" at any moment just from
 * `endsAt - Date.now()` — it survives navigation, and even a full page
 * reload, without needing to keep running in the background itself.
 *
 * Deliberately a single global slot, not one per session/exercise — an
 * athlete is only ever resting from one set at a time.
 */

const STORAGE_KEY = "ultimate-training:rest-timer";
const EVENT_NAME = "ultimate-training:rest-timer-update";

export type RestTimerState = {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  /** Epoch ms when the rest period ends. */
  endsAt: number;
};

function notify() {
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    // non-browser context — nothing to notify
  }
}

export function startRestTimer(state: RestTimerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notify();
  } catch {
    // best-effort only — the in-page countdown still works for this session
    // even if persistence fails (private browsing, storage disabled, etc.)
  }
}

export function clearRestTimer() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    notify();
  } catch {
    // best-effort only
  }
}

/** Adds (or subtracts, with a negative value) seconds to the active timer's end time. */
export function adjustRestTimer(deltaSeconds: number) {
  const current = readRestTimer();
  if (!current) return;
  current.endsAt += deltaSeconds * 1000;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    notify();
  } catch {
    // best-effort only
  }
}

export function readRestTimer(): RestTimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RestTimerState;
    if (!parsed || typeof parsed.endsAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export { STORAGE_KEY as REST_TIMER_STORAGE_KEY, EVENT_NAME as REST_TIMER_EVENT_NAME };
