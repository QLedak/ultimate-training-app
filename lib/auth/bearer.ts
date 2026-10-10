/** Pulls the token out of an "Authorization: Bearer <token>" header value. */
export function parseBearerToken(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const m = headerValue.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}
