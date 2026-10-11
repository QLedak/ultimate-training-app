/**
 * Offline log queue (pure logic, no React Native imports so it can be unit tested).
 *
 * A finished workout that can't reach the server is saved here and re-sent later.
 * The server replaces any earlier log for the same session, so re-sending is safe.
 */
import type { SubmitPayload } from "../types";

export type PendingLog = {
  sessionId: string;
  payload: SubmitPayload;
  queuedAt: string;
  /** Set when the server rejected it (not a connection problem). Kept so nothing is lost silently. */
  lastError?: string;
};

export type QueueStore = {
  read: () => Promise<PendingLog[]>;
  write: (items: PendingLog[]) => Promise<void>;
};

/** Throws an error with a numeric `status` (0 = no connection, 401 = signed out). */
export type SendLog = (sessionId: string, payload: SubmitPayload) => Promise<void>;

export type FlushResult = {
  synced: number;
  /** Still waiting (offline or signed out). */
  waiting: number;
  /** Rejected by the server; needs the athlete's attention. */
  rejected: number;
};

export function createQueue(store: QueueStore, send: SendLog, now: () => string = () => new Date().toISOString()) {
  let flushing: Promise<FlushResult> | null = null;

  async function enqueue(sessionId: string, payload: SubmitPayload) {
    const items = (await store.read()).filter((i) => i.sessionId !== sessionId);
    items.push({ sessionId, payload, queuedAt: now() });
    await store.write(items);
  }

  async function list() {
    return store.read();
  }

  async function has(sessionId: string) {
    return (await store.read()).some((i) => i.sessionId === sessionId);
  }

  async function discard(sessionId: string) {
    await store.write((await store.read()).filter((i) => i.sessionId !== sessionId));
  }

  async function runFlush(): Promise<FlushResult> {
    const items = await store.read();
    const result: FlushResult = { synced: 0, waiting: 0, rejected: 0 };
    const remaining: PendingLog[] = [];
    let stop = false;

    for (const item of items) {
      if (stop) {
        remaining.push(item);
        continue;
      }
      try {
        await send(item.sessionId, item.payload);
        result.synced++;
      } catch (e) {
        const status = typeof (e as { status?: unknown })?.status === "number" ? (e as { status: number }).status : -1;
        if (status === 0 || status === 401 || status >= 500) {
          // Offline, signed out, or server trouble: keep it and try again later. Stop so we don't hammer.
          remaining.push(item);
          stop = true;
        } else {
          remaining.push({ ...item, lastError: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    // Re-read so anything queued while we were sending isn't lost.
    const sent = new Set(items.map((i) => i.sessionId));
    const fresh = (await store.read()).filter((i) => !sent.has(i.sessionId));
    const final = [...remaining, ...fresh];
    await store.write(final);

    result.rejected = final.filter((i) => i.lastError).length;
    result.waiting = final.length - result.rejected;
    return result;
  }

  /** Tries to send everything queued. Concurrent calls share one run. */
  function flush(): Promise<FlushResult> {
    if (!flushing) flushing = runFlush().finally(() => { flushing = null; });
    return flushing;
  }

  return { enqueue, list, has, discard, flush };
}
