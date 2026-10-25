/** Splits a seconds string into minutes and seconds for the time wheels (pure, unit tested). */
export function splitSeconds(value: string): { m: number; s: number } {
  const n = Math.max(0, parseInt(value, 10) || 0);
  return { m: Math.min(59, Math.floor(n / 60)), s: n % 60 };
}
