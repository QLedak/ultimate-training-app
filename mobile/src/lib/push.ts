import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";
import { ensurePermission } from "./reminders";
import { projectIdFrom, pushEnabledFromStore } from "./push.core";

const ENABLED_KEY = "push-enabled:v1";
const TOKEN_KEY = "push-token:v1";

export async function pushEnabled(): Promise<boolean> {
  try {
    return pushEnabledFromStore(await AsyncStorage.getItem(ENABLED_KEY));
  } catch {
    return true;
  }
}

async function fetchToken(): Promise<string | null> {
  const projectId = projectIdFrom(Constants as any);
  if (!projectId) return null; // not linked to an Expo project yet (Expo Go before `eas init`)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "default", importance: Notifications.AndroidImportance.DEFAULT });
  }
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

async function register(athleteId: string): Promise<boolean> {
  const token = await fetchToken();
  if (!token) return false;
  await api(`/api/athletes/${athleteId}/push-token`, { method: "POST", body: { token, platform: Platform.OS } });
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return true;
}

/**
 * Quietly keeps this phone registered. Only runs when notifications are already allowed and the
 * athlete hasn't turned coach updates off; it never shows a permission prompt. Never throws.
 */
export async function syncPushRegistration(athleteId: string): Promise<void> {
  try {
    if (!(await pushEnabled())) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await register(athleteId);
  } catch {
    // push is a convenience
  }
}

/** Turns coach updates on: asks for permission if needed, registers, remembers the choice. */
export async function enablePush(athleteId: string): Promise<"on" | "blocked" | "unavailable"> {
  try {
    if (!(await ensurePermission())) return "blocked";
    await AsyncStorage.setItem(ENABLED_KEY, "on");
    return (await register(athleteId)) ? "on" : "unavailable";
  } catch {
    return "unavailable";
  }
}

/** Stops pushes to this phone: forgets it on the server and remembers the choice. */
export async function disablePush(athleteId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, "off");
    await forgetToken(athleteId);
  } catch {
    // best-effort
  }
}

/** Removes this phone's token from the server (used on sign out so the next person on the phone isn't notified). */
export async function forgetToken(athleteId: string): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await api(`/api/athletes/${athleteId}/push-token`, { method: "DELETE", body: { token } });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // best-effort
  }
}
