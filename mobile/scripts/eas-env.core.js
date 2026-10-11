// Builds the "env" block for eas.json from the text of mobile/.env (pure, so it can be tested).
// EAS cloud builds don't include .env (it's git-ignored), so the public values are copied into eas.json.
const REQUIRED = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_API_URL"];
const OPTIONAL = ["EXPO_PUBLIC_SUPPORT_EMAIL"];

function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

// A Supabase service-role key is a JWT whose payload says role=service_role. It must never ship in an app.
function isServiceRoleKey(value) {
  try {
    const payload = JSON.parse(Buffer.from(String(value).split(".")[1] || "", "base64").toString("utf8"));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function buildEasEnv(text) {
  const vars = parseEnv(text);
  const missing = REQUIRED.filter((k) => !vars[k] || /your-/.test(vars[k]));
  if (missing.length) return { ok: false, error: `Fill these in mobile/.env first: ${missing.join(", ")}` };
  if (isServiceRoleKey(vars.EXPO_PUBLIC_SUPABASE_ANON_KEY)) {
    return { ok: false, error: "EXPO_PUBLIC_SUPABASE_ANON_KEY is a service-role key. Use the anon (public) key. Never put the service-role key in the app." };
  }
  vars.EXPO_PUBLIC_API_URL = vars.EXPO_PUBLIC_API_URL.replace(/\/+$/, "");
  if (!/^https:\/\//.test(vars.EXPO_PUBLIC_API_URL)) {
    return { ok: false, error: "EXPO_PUBLIC_API_URL must be your deployed https:// website for TestFlight builds (not a local http:// address)." };
  }
  const env = {};
  for (const k of [...REQUIRED, ...OPTIONAL]) if (vars[k]) env[k] = vars[k];
  return { ok: true, env };
}

// Puts env into the preview and production build profiles, leaving everything else in eas.json alone.
function applyEnv(easJson, env) {
  const out = { ...easJson, build: { ...(easJson.build || {}) } };
  for (const profile of ["preview", "production"]) {
    out.build[profile] = { ...(out.build[profile] || {}), env: { ...((out.build[profile] || {}).env || {}), ...env } };
  }
  return out;
}

module.exports = { parseEnv, isServiceRoleKey, buildEasEnv, applyEnv };
