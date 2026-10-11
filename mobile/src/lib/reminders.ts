import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { api } from "./api";
import { addDays, todayStr } from "./dates";
import { DEFAULT_REMINDERS, planReminders, type ReminderSettings, type UpcomingSession } from "./reminders.core";

const KEY = "reminder-settings:v1";
const WINDOW_DAYS = 14;

// Show the banner even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_REMINDERS, ...(JSON.parse(raw) as Partial<ReminderSettings>) } : DEFAULT_REMINDERS;
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export async function saveReminderSettings(s: ReminderSettings) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

/** Asks iOS for permission if we haven't yet. Returns whether notifications are allowed. */
export async function ensurePermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/**
 * Rebuilds the phone's scheduled reminders from the server schedule. Safe to call often
 * (app open, after logging a workout, after changing settings): it replaces what's pending.
 * Never throws; reminders are a convenience, not something that should break the app.
 */
export async function syncReminders(athleteId: string): Promise<number> {
  try {
    const settings = await loadReminderSettings();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.enabled) return 0;
    if (!(await Notifications.getPermissionsAsync()).granted) return 0;

    const start = todayStr();
    const d = await api<{ sessions: UpcomingSession[] }>(`/api/athletes/${athleteId}/sessions?start=${start}&end=${addDays(start, WINDOW_DAYS)}`);
    const plan = planReminders(d.sessions ?? [], settings, new Date());
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt },
      });
    }
    return plan.length;
  } catch {
    return 0;
  }
}

export async function sendTestReminder() {
  await Notifications.scheduleNotificationAsync({
    content: { title: "Workout today: Lower Strength", body: "This is what your reminder will look like." },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
}
