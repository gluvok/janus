import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  SESSION_HEADER_KEYS,
  ADMIN,
  ADMIN_MANAGER,
  NOTIFY_ROLES,
  isRoleAllowed,
  stripSessionHeaders,
  safeNextPath,
  quotePostgrestValue,
  parseBasicAuth,
} from "../lib/security.ts";
import { hashPassword, verifyPassword, DUMMY_HASH } from "../lib/password.ts";
import { hashApiKey, apiKeyMatches, generateApiKey, DUMMY_KEY_HASH } from "../lib/api-key.ts";
import { signHs256 } from "../lib/realtime-token.ts";
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
  "/\t/evil.com",
  "/\n/evil.com",
  "/\r/evil.com",
  "/\t\\evil.com",
]) {
  assert.equal(safeNextPath(bad), "/");
}
assert.equal(safeNextPath("/a?b=c%09d"), "/a?b=c%09d"); // encoded tab is fine
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

const jwt = signHs256({ sub: "1", exp: 9 }, "s3cret");
const [h, p, sig] = jwt.split(".");
assert.equal(sig, createHmac("sha256", "s3cret").update(`${h}.${p}`).digest("base64url"));
assert.deepEqual(JSON.parse(Buffer.from(p, "base64url").toString()), { sub: "1", exp: 9 });
console.log("✓ realtime token signing");

const b64 = (s: string) => `Basic ${Buffer.from(s).toString("base64")}`;
assert.deepEqual(parseBasicAuth(b64("12:s3cret")), { id: "12", key: "s3cret" });
assert.deepEqual(parseBasicAuth(b64("12:a:b")), { id: "12", key: "a:b" }); // RFC 7617: split on first ":"
assert.deepEqual(parseBasicAuth(`basic  ${Buffer.from("1:k").toString("base64")}`), {
  id: "1",
  key: "k",
});
assert.equal(parseBasicAuth(null), null);
assert.equal(parseBasicAuth("Bearer abc"), null);
assert.equal(parseBasicAuth("Basic !!!"), null);
assert.equal(parseBasicAuth(b64("nocolon")), null);
assert.equal(parseBasicAuth(b64(":keyonly")), null);
assert.equal(parseBasicAuth(b64("12:")), null); // empty key
console.log("✓ basic auth parser");

const key = generateApiKey();
assert.match(key, /^[A-Za-z0-9_-]{43}$/);
assert.match(hashApiKey(key), /^[0-9a-f]{64}$/);
assert.equal(apiKeyMatches(key, hashApiKey(key)), true);
assert.equal(apiKeyMatches(key + "x", hashApiKey(key)), false);
assert.equal(apiKeyMatches(key, DUMMY_KEY_HASH), false);
assert.equal(apiKeyMatches(key, "not-hex"), false); // malformed stored hash: false, never throws
assert.equal(apiKeyMatches(key, ""), false);
// matches what Postgres backfills: encode(sha256(convert_to('abc','UTF8')),'hex')
assert.equal(hashApiKey("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
console.log("✓ api key hash + constant-time compare");
