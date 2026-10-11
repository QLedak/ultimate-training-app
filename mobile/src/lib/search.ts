/** Case-insensitive match where every typed word must appear in the name ("bench barb" finds "Barbell Bench Press"). */
export function matchesSearch(name: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = name.toLowerCase();
  return words.every((w) => hay.includes(w));
}
