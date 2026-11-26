import assert from "node:assert/strict";
import { SESSION_HEADER_KEYS, ADMIN, NOTIFY_ROLES } from "../lib/security.ts";

assert.equal(SESSION_HEADER_KEYS.length, 11);
assert.deepEqual(ADMIN, ["admin"]);
assert.ok(!NOTIFY_ROLES.includes("base"));
console.log("✓ security helpers");

import { supabase } from "../lib/supabase.ts"; // importing must not read env or build a client

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
assert.throws(() => supabase.from("users"), /SUPABASE_URL and SUPABASE_SECRET_KEY/);
console.log("✓ supabase client is lazy");
