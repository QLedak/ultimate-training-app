import { API_URL } from "../config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Calls the existing web backend with the signed-in user's token. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection.", 0);
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok || (json && json.error)) {
    throw new ApiError(json?.error ?? json?.message ?? `Request failed (${res.status})`, res.status);
  }
  return json as T;
}
