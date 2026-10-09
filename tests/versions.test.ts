/* Run: npx tsx tests/versions.test.ts */
import assert from "node:assert/strict";
import { latestDraft, isNewerDraft, nextVersionInLineage } from "../lib/review/versions";

const rows = [
  { id: "a", version: 8, created_at: "2026-10-01T10:00:00Z" },
  { id: "b", version: 9, created_at: "2026-10-09T15:00:00Z" },
  { id: "c", version: 9, created_at: "2026-10-09T16:30:00Z" }, // duplicate v9, created later
];
assert.equal(latestDraft(rows)!.id, "c");
assert.equal(latestDraft([...rows].reverse())!.id, "c"); // order-independent
assert.ok(isNewerDraft(rows[2], rows[1]));
assert.ok(!isNewerDraft(rows[1], rows[2]));
assert.equal(latestDraft([]), null);

const mock: any = { from: () => { const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ data: { version: 9 }, error: null }) }; return q; } };
nextVersionInLineage(mock, "L").then((v) => { assert.equal(v, 10); console.log("3 version tests passed"); });
