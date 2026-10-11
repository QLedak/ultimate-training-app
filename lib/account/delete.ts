/** Validation for DELETE /api/me/account. The caller must type the word DELETE so it can't happen by accident. */
export function validateDeleteRequest(body: unknown): { ok: true } | { ok: false; error: string } {
  const confirm = (body as { confirm?: unknown } | null)?.confirm;
  if (typeof confirm !== "string" || confirm.trim().toUpperCase() !== "DELETE") {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }
  return { ok: true };
}
