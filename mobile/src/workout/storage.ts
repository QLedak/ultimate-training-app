import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GuidedProgress } from "../types";

const key = (sessionId: string) => `guided-workout:${sessionId}`;

export async function saveProgress(sessionId: string, p: GuidedProgress) {
  try {
    await AsyncStorage.setItem(key(sessionId), JSON.stringify(p));
  } catch {
    // best-effort only
  }
}

export async function loadProgress(sessionId: string): Promise<GuidedProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(key(sessionId));
    return raw ? (JSON.parse(raw) as GuidedProgress) : null;
  } catch {
    return null;
  }
}

export async function clearProgress(sessionId: string) {
  try {
    await AsyncStorage.removeItem(key(sessionId));
  } catch {
    // best-effort only
  }
}
