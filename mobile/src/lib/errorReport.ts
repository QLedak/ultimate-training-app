import { Platform } from "react-native";
import Constants from "expo-constants";
import { API_URL } from "../config";
import { buildErrorReport, createDeduper } from "./errorReport.core";

export const APP_VERSION: string = Constants.expoConfig?.version ?? "dev";
const shouldSend = createDeduper();

/** Fire-and-forget crash report to the backend (which forwards to Sentry). Never throws. */
export function reportError(error: unknown, context: string, fatal = false) {
  try {
    const report = buildErrorReport(error, context, { platform: Platform.OS, appVersion: APP_VERSION }, fatal);
    if (!shouldSend(`${report.context}|${report.message}`)) return;
    fetch(`${API_URL}/api/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    }).catch(() => {});
  } catch {
    // reporting must never cause a second crash
  }
}

/** Reports uncaught JavaScript errors, then lets React Native's normal handler run. */
export function installGlobalErrorHandler() {
  const eu = (globalThis as any).ErrorUtils;
  if (!eu?.setGlobalHandler) return;
  const previous = eu.getGlobalHandler?.();
  eu.setGlobalHandler((err: unknown, isFatal?: boolean) => {
    reportError(err, "global", !!isFatal);
    previous?.(err, isFatal);
  });
}
