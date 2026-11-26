import assert from "node:assert/strict";
import {
  SESSION_HEADER_KEYS,
  ADMIN,
  ADMIN_MANAGER,
  NOTIFY_ROLES,
  isRoleAllowed,
  stripSessionHeaders,
} from "../lib/security.ts";
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
