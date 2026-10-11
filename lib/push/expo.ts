import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Expo push notifications. No extra package: Expo's push service is a plain HTTPS API.
 * Everything here is best-effort and never throws, so a push problem can never fail a coach action.
 */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100;

export type PushPayload = { title: string; body: string; data?: Record<string, unknown> };

export function isExpoPushToken(t: unknown): t is string {
  return typeof t === "string" && /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(t);
}

export function buildPushMessages(tokens: string[], p: PushPayload) {
  return tokens.filter(isExpoPushToken).map((to) => ({ to, title: p.title, body: p.body, data: p.data ?? {}, sound: "default", priority: "high" }));
}

export function chunk<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Tokens Expo says no longer work (app deleted, notifications revoked); these get removed. */
export function deadTokensFromTickets(tokens: string[], tickets: unknown): string[] {
  if (!Array.isArray(tickets)) return [];
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    if (t && t.status === "error" && t.details?.error === "DeviceNotRegistered" && tokens[i]) dead.push(tokens[i]);
  });
  return dead;
}

/** What the athlete sees when the coach publishes. */
export function planPublishedMessage(callType: string): PushPayload {
  if (callType === "macrocycle_planner") {
    return { title: "Your season plan is ready", body: "Your coach published your plan. Tap to see what's coming up.", data: { screen: "Today" } };
  }
  return { title: "Your plan was updated", body: "Your coach published new workouts. Tap to see your schedule.", data: { screen: "Today" } };
}

/** Sends a push to every device the athlete has registered. Returns how many were accepted for sending. */
export async function sendPushToAthlete(supabase: SupabaseClient, athleteId: string, payload: PushPayload): Promise<number> {
  try {
    const { data: rows } = await supabase.from("push_tokens").select("token").eq("athlete_id", athleteId);
    const tokens = (rows ?? []).map((r: { token: string }) => r.token).filter(isExpoPushToken);
    if (tokens.length === 0) return 0;

    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

    let sent = 0;
    for (const group of chunk(tokens)) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(buildPushMessages(group, payload)),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        console.error("[push] Expo push service returned", res.status);
        continue;
      }
      const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
      const dead = deadTokensFromTickets(group, json?.data);
      sent += group.length - dead.length;
      if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
    }
    return sent;
  } catch (e) {
    console.error("[push] send failed:", e instanceof Error ? e.message : e);
    return 0;
  }
}
