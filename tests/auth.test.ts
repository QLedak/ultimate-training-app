/* Run: npx tsx tests/auth.test.ts */
import assert from "node:assert/strict";
import { parseBearerToken } from "../lib/auth/bearer";

assert.equal(parseBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
assert.equal(parseBearerToken("bearer abc"), "abc");
assert.equal(parseBearerToken("Basic abc"), null);
assert.equal(parseBearerToken("Bearer"), null);
assert.equal(parseBearerToken("Bearer a b"), null);
assert.equal(parseBearerToken(""), null);
assert.equal(parseBearerToken(null), null);
assert.equal(parseBearerToken(undefined), null);
console.log("8 auth tests passed");
