import assert from "node:assert/strict";
import {
  SESSION_HEADER_KEYS,
  ADMIN,
  ADMIN_MANAGER,
  NOTIFY_ROLES,
  isRoleAllowed,
  stripSessionHeaders,
  safeNextPath,
  quotePostgrestValue,
} from "../lib/security.ts";
import { hashPassword, verifyPassword, DUMMY_HASH } from "../lib/password.ts";
import { supabase } from "../lib/supabase.ts"; // importing must not read env or build a client

assert.equal(SESSION_HEADER_KEYS.length, 11);
assert.deepEqual(ADMIN, ["admin"]);
assert.ok(!NOTIFY_ROLES.includes("base"));
console.log("✓ security helpers");

assert.equal(isRoleAllowed(undefined, "base"), true);
assert.equal(isRoleAllowed(ADMIN, "manager"), false);
assert.equal(isRoleAllowed(ADMIN_MANAGER, "manager"), true);
assert.equal(isRoleAllowed(ADMIN, "admin"), true);
console.log("✓ role guard predicate");

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
assert.throws(() => supabase.from("users"), /SUPABASE_URL and SUPABASE_SECRET_KEY/);
console.log("✓ supabase client is lazy");

process.env.SUPABASE_URL = "http://localhost:1";
process.env.SUPABASE_SECRET_KEY = "test";
assert.equal(typeof supabase.from("users").select, "function");
assert.equal(typeof supabase.rpc, "function");
const { from } = supabase; // destructured call proves methods are bound to the real client
assert.equal(typeof from("users").select, "function");
console.log("✓ supabase proxy binds methods");

const spoofed = new Headers({
  "x-user-id": "1",
  "x-user-role": "admin",
  "x-pathname": "/x",
  accept: "*/*",
});
const clean = stripSessionHeaders(spoofed);
assert.equal(clean.get("x-user-id"), null);
assert.equal(clean.get("x-user-role"), null);
assert.equal(clean.get("x-pathname"), null);
assert.equal(clean.get("accept"), "*/*");
assert.equal(spoofed.get("x-user-id"), "1"); // input not mutated
console.log("✓ forged session headers stripped");

assert.equal(safeNextPath("/weighments?id=2"), "/weighments?id=2");
for (const bad of [
  null,
  "",
  "//evil.com",
  "/\\evil.com",
  "https://evil.com",
  "javascript:alert(1)",
]) {
  assert.equal(safeNextPath(bad), "/");
}
assert.equal(quotePostgrestValue("%a,b)%"), '"%a,b)%"');
assert.equal(quotePostgrestValue('x"\\y'), '"x\\"\\\\y"');
console.log("✓ redirect + postgrest quoting");

const fresh = await hashPassword("pw-123");
assert.ok(fresh.startsWith("$argon2id$"));
assert.equal(await verifyPassword("pw-123", fresh), true);
assert.equal(await verifyPassword("nope", fresh), false);
assert.equal(await verifyPassword("x", "not-a-hash"), false); // never throws
// DUMMY_HASH: static, same cost params as real hashes → missing-user path costs the same as a wrong password.
const params = (h: string) => h.split("$").slice(1, 4).join("$"); // argon2id$v=19$m=…,t=…,p=…
assert.equal(params(DUMMY_HASH), params(fresh));
assert.equal(await verifyPassword("wrong", DUMMY_HASH), false);
console.log("✓ password boundary");
