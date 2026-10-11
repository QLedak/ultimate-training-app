/** Push-notification preference and projectId helpers (pure). */

/** Pushes are on unless the athlete turned them off. */
export function pushEnabledFromStore(raw: string | null): boolean {
  return raw !== "off";
}

/** Expo project id from the app config (set by `eas init`); null when not linked yet (e.g. Expo Go). */
export function projectIdFrom(cfg: { expoConfig?: any; easConfig?: any } | null | undefined): string | null {
  const id = cfg?.expoConfig?.extra?.eas?.projectId ?? cfg?.easConfig?.projectId;
  return typeof id === "string" && id ? id : null;
}

/** Where a tapped push should take the athlete. Unknown values fall back to Today. */
export function screenForPush(data: unknown): "Today" | "Schedule" | "Programs" {
  const s = (data as { screen?: unknown } | null)?.screen;
  return s === "Schedule" || s === "Programs" ? s : "Today";
}
