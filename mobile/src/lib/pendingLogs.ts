import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { createQueue, type PendingLog } from "./pendingLogs.core";

const KEY = "pending-logs:v1";

const queue = createQueue(
  {
    read: async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as PendingLog[]) : [];
      } catch {
        return [];
      }
    },
    write: async (items) => {
      try {
        if (items.length === 0) await AsyncStorage.removeItem(KEY);
        else await AsyncStorage.setItem(KEY, JSON.stringify(items));
      } catch {
        // best-effort
      }
    },
  },
  async (sessionId, payload) => {
    await api(`/api/sessions/${sessionId}/log`, { method: "POST", body: payload });
  }
);

export const enqueueLog = queue.enqueue;
export const listPendingLogs = queue.list;
export const hasPendingLog = queue.has;
export const discardPendingLog = queue.discard;
export const flushPendingLogs = queue.flush;
