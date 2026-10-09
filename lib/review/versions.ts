import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Draft version bookkeeping for a lineage.
 *
 * Two bugs lived here: new versions were numbered "source version + 1", so
 * two rebuilds/edits started from the same source (a double click, or a
 * rebuild after a rejected rebuild) both became, say, v9. Approve then
 * compared against whichever v9 the database happened to return first and
 * answered "This is v9, but v9 is the latest version". The fixes:
 *   1. New versions are numbered max(version in the lineage) + 1.
 *   2. "Latest" is defined once, here: highest version, ties broken by
 *      newest created_at, then id. The review list and approve both use it.
 */
export async function nextVersionInLineage(supabase: SupabaseClient, lineageId: string): Promise<number> {
  const { data, error } = await supabase
    .from("program_drafts")
    .select("version")
    .eq("lineage_id", lineageId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return ((data?.version as number | undefined) ?? 0) + 1;
}

export type VersionedRow = { id: string; version: number; created_at?: string | null };

/** True when `a` is a newer draft than `b` within one lineage. */
export function isNewerDraft(a: VersionedRow, b: VersionedRow): boolean {
  if (a.version !== b.version) return a.version > b.version;
  const ac = a.created_at ?? "";
  const bc = b.created_at ?? "";
  if (ac !== bc) return ac > bc;
  return a.id > b.id;
}

export function latestDraft<T extends VersionedRow>(rows: T[]): T | null {
  let best: T | null = null;
  for (const r of rows) if (!best || isNewerDraft(r, best)) best = r;
  return best;
}
