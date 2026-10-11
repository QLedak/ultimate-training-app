/** Cleans a crash report sent by the mobile app before it is logged. Returns null if it isn't usable. */
export type ClientError = {
  message: string;
  stack: string;
  context: string;
  platform: string;
  appVersion: string;
  fatal: boolean;
};

const cut = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function sanitizeClientError(body: unknown): ClientError | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const message = cut(b.message, 500).trim();
  if (!message) return null;
  return {
    message,
    stack: cut(b.stack, 4000),
    context: cut(b.context, 100),
    platform: cut(b.platform, 40),
    appVersion: cut(b.appVersion, 40),
    fatal: b.fatal === true,
  };
}
