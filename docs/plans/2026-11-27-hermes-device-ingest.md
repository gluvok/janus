# Hermes Device Ingest Implementation Plan

> **For Claude:** Execute subagent-driven. Each subagent loads **@ponytail (full)** plus the one special skill named in its task. It works in the worktree `/Users/kaalu/workkkkk/janus-migration/.claude/worktrees/nostalgic-lichterman-a7a39d` on branch `feat/hermes-device-ingest`, which is cut from the committed tip of `fix/security-and-pr9-port` (`c708603`). It touches only its listed files and does **not** commit. The main session reviews each diff, commits, and runs **@verification-loop** at the end.

**Goal:** `POST /api/entries` takes Hermes's existing multipart request, authenticated with HTTP Basic `center_id:api_key` against a SHA-256 hash in `centers.api_key_hash`. Hermes needs no code change.

**Architecture:** The proxy lets `POST /api/entries` through without a session, the same way it lets `/api/auth/login` through, and still strips forged `x-user-*` headers. The route does all auth itself: it parses Basic, looks up the center, does a constant-time digest compare, applies a per-center rate limit, validates with zod, uploads to the `mesto` bucket and inserts into `automatic_entries`. Keys are stored only as SHA-256 hex. An admin-only endpoint rotates a key and returns the plain key once.

**Tech Stack:** Next.js 16 route handlers, `@supabase/supabase-js` (lazy `lib/supabase.ts`), zod 4, `lru-cache`, `node:crypto`, node strip-types assert scripts.

---

## Hermes contract (from `../hermes/src/integrations/gluvok.py`)

| Hermes does | Route must |
| --- | --- |
| `auth=(device_id, device_key)` → `Authorization: Basic …` | Parse Basic only. No form-field creds, no `x-api-key`. |
| form `center_id`, `detected_vehicle_number`, `weight` (3 dp string) | Validate all three. If `center_id` ≠ authenticated id, return 403. |
| `file` parts, `image/jpeg`, already compressed | Store as-is. No `sharp`. |
| On a 400 whose body contains "storage", retries with **one zero-byte `file`** | Upload failure → `400 {"error":"Image storage failed."}`. Drop zero-byte files. |
| `ReadTimeout` → retryable, so the request may be re-sent | Use a content-derived `idempotency_key`. A duplicate returns 200 with the existing id. |
| Success = 200/201, reads `data.id` | `201 {"data":{"id":N}}` |
| Plate `NO_PLATE_DETECTED` (placeholders are already folded into it) | Accept the literal; map `REJECTED_*` to it. Master janus stores this same literal. |

## Decisions and deviations (read before starting)

1. **`node:crypto` stays out of `lib/security.ts`.** `components/login-form.tsx` and `components/notification-bell.tsx` (both client components) import it. The brief said to keep everything in `lib/security.ts`. Instead, the pure Basic parser goes there (it uses `atob`), and the SHA-256 and `timingSafeEqual` helpers go in a new `lib/api-key.ts`. Neither file has `@/` imports, and both are tested from `scripts/test-security.ts`.
2. **SHA-256, not argon2, for API keys.** The keys are 256-bit random values, so a slow KDF adds nothing and would cost an argon2 run on every Pi request. This supersedes, for API keys only, the security plan's checklist item "keys hashed only through `lib/password.ts`". That plan file is untracked in the main checkout, so the parent session updates it.
3. **Existing keys keep working.** The migration backfills `api_key_hash = sha256(api_key)` and then drops the plain `api_key` column.
4. **The rate limit counts only authenticated requests.** A 256-bit key can't be brute-forced, and counting failed attempts would let anyone lock a center out by sending bad keys under its id.
5. **`chk_automatic_entries_vehicle` is widened** to allow `'NO_PLATE_DETECTED'`, which is 17 characters and fails the current 8–11 rule. A plate that is present but invalid gets 400, as on master.
6. **Out of scope (follow-ups):** `factories.api_key` is still plain text; there's no rotate button in the UI; the rate limit is per instance.

## Preconditions

- **Branch, not the main checkout.** The main checkout has the parent session's uncommitted edits to `schema.sql`, `README.md`, `lib/auth.ts` and others. This work lives on `feat/hermes-device-ingest`; the parent merges or cherry-picks it into `fix/security-and-pr9-port` after committing its own WIP. Expect possible conflicts in `schema.sql` and `README.md`.
- **Local DB for Task 5:** `supabase-local` holds master janus data. **Ask the user first** (see Task 5).

## Dispatch graph

```
Wave 1 (parallel, disjoint files):  T1 helpers+tests   T2 schema+seeds
Wave 2 (parallel, disjoint files):  T3 proxy+route     T4 rotate endpoint+README
Wave 3:                             T5 end-to-end curl
Final (main session):               @verification-loop  → commit
```

| Task | Subagent type | Skills |
| --- | --- | --- |
| T1 | tdd-guide | @ponytail + @test-driven-development |
| T2 | general-purpose | @ponytail + @database-migrations |
| T3 | general-purpose | @ponytail + @api-security-best-practices |
| T4 | general-purpose | @ponytail + @secrets-management |
| T5 | general-purpose | @ponytail + @hunt-auth-bypass |
| Final | main session | @ponytail + @verification-loop |

Every subagent runs commands with `PATH=/opt/homebrew/bin:$PATH`. It never runs `pnpm build` or bare `pnpm fmt`; it formats with `pnpm exec oxfmt <its files>`.

---

### Task 1: Basic-auth parser and constant-time key compare (TDD)

**Skills:** @ponytail + @test-driven-development

**Files:**
- Modify: `lib/security.ts` (append)
- Create: `lib/api-key.ts`
- Modify: `scripts/test-security.ts` (append tests and imports)

**Step 1: Write the failing tests.** Append to `scripts/test-security.ts`, adding `parseBasicAuth` to the existing `../lib/security.ts` import:

```ts
import { hashApiKey, apiKeyMatches, generateApiKey, DUMMY_KEY_HASH } from "../lib/api-key.ts";

const b64 = (s: string) => `Basic ${Buffer.from(s).toString("base64")}`;
assert.deepEqual(parseBasicAuth(b64("12:s3cret")), { id: "12", key: "s3cret" });
assert.deepEqual(parseBasicAuth(b64("12:a:b")), { id: "12", key: "a:b" }); // RFC 7617: split on first ":"
assert.deepEqual(parseBasicAuth(`basic  ${Buffer.from("1:k").toString("base64")}`), { id: "1", key: "k" });
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
```

**Step 2: Run them and confirm they fail.**
Run: `PATH=/opt/homebrew/bin:$PATH node --experimental-strip-types scripts/test-security.ts`
Expected: FAIL. `parseBasicAuth` is not exported and `../lib/api-key.ts` is not found.

**Step 3: Implement.** Append to `lib/security.ts`:

```ts
/** `Authorization: Basic base64(id:key)` → { id, key }, else null. Splits on the first ":" (RFC 7617). */
export function parseBasicAuth(header: string | null): { id: string; key: string } | null {
  const match = header?.match(/^Basic +([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return null;
  let decoded: string;
  try {
    decoded = atob(match[1]);
  } catch {
    return null;
  }
  const sep = decoded.indexOf(":");
  if (sep <= 0 || sep === decoded.length - 1) return null;
  return { id: decoded.slice(0, sep), key: decoded.slice(sep + 1) };
}
```

Create `lib/api-key.ts`:

```ts
/**
 * @file lib/api-key.ts
 * @description Center API keys: SHA-256 at rest, constant-time compare. Server-only (node:crypto), no @/ imports.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Compared against when the center doesn't exist, so unknown id and wrong key take the same path. */
export const DUMMY_KEY_HASH = "0".repeat(64);

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Both sides are 32-byte digests, so timingSafeEqual never sees unequal lengths from user input. */
export function apiKeyMatches(key: string, storedHash: string): boolean {
  const given = createHash("sha256").update(key, "utf8").digest();
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === given.length && timingSafeEqual(given, stored);
}

/** 256-bit, URL-safe: fits a Basic password and Hermes's license file. */
export function generateApiKey(): string {
  return randomBytes(32).toString("base64url");
}
```

**Step 4: Run and confirm they pass.** Same command. Expected: both new ✓ lines print and the script exits 0.

**Step 5:** `pnpm exec oxfmt lib/security.ts lib/api-key.ts scripts/test-security.ts && pnpm type-check`. Report the diff. Don't commit.

---

### Task 2: Hash center keys at rest and allow the `NO_PLATE_DETECTED` plate

**Skills:** @ponytail + @database-migrations

**Files:**
- Modify: `schema.sql:61-77` (centers table and its api_key migration block)
- Modify: `schema.sql:176-187` (automatic_entries vehicle check)
- Modify: `scripts/seed.ts:~215-251`, `scripts/test-seed/centers.ts:~55`, `scripts/test-validation.ts:~152`
- Modify: `app/centers/types.ts:14` (drop `api_key`)

`schema.sql` is re-run in full, so every statement must be idempotent. Match the file's existing `DO $$ … pg_constraint` style.

**Step 1: centers table definition.** Replace the `api_key TEXT NOT NULL UNIQUE,` line with `api_key_hash TEXT NOT NULL UNIQUE,`. Replace `CONSTRAINT chk_centers_api_key CHECK (length(trim(api_key)) >= 16)` with `CONSTRAINT chk_centers_api_key_hash CHECK (api_key_hash ~ '^[0-9a-f]{64}$')`.

**Step 2: migration block.** Replace lines 73-77 (`ADD COLUMN api_key` … `idx_centers_api_key`) with:

```sql
-- Center API keys are stored only as SHA-256 hex. Existing plain keys keep working (hash backfilled).
ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS api_key_hash TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'centers' AND column_name = 'api_key'
  ) THEN
    UPDATE public.centers
    SET api_key_hash = encode(sha256(convert_to(api_key, 'UTF8')), 'hex')
    WHERE api_key_hash IS NULL AND api_key IS NOT NULL;
    ALTER TABLE public.centers DROP COLUMN api_key; -- drops idx_centers_api_key and chk_centers_api_key with it
  END IF;
END $$;
-- Any row still without a key gets an unusable random hash; an admin rotates it to issue a real key.
UPDATE public.centers
SET api_key_hash = encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex')
WHERE api_key_hash IS NULL;
ALTER TABLE public.centers ALTER COLUMN api_key_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_centers_api_key_hash ON public.centers (api_key_hash);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_centers_api_key_hash' AND conrelid = 'public.centers'::regclass
  ) THEN
    ALTER TABLE public.centers
      ADD CONSTRAINT chk_centers_api_key_hash CHECK (api_key_hash ~ '^[0-9a-f]{64}$');
  END IF;
END $$;
```

**Step 3: automatic_entries plate check.** In the table definition, change the check to `CHECK (vehicle_number = 'NO_PLATE_DETECTED' OR length(trim(vehicle_number)) BETWEEN 8 AND 11)`. Right after the table's indexes, add:

```sql
ALTER TABLE public.automatic_entries DROP CONSTRAINT IF EXISTS chk_automatic_entries_vehicle;
ALTER TABLE public.automatic_entries ADD CONSTRAINT chk_automatic_entries_vehicle
  CHECK (vehicle_number = 'NO_PLATE_DETECTED' OR length(trim(vehicle_number)) BETWEEN 8 AND 11);
```

Then grep `schema.sql` and `app/` for places that consume `automatic_entries.vehicle_number` (views, weighment triggers, joins to manual entries). Report any that would misbehave on `NO_PLATE_DETECTED`. Report them; don't fix them.

**Step 4: seeds.** These scripts run under node strip-types, so import with a relative path: `import { generateApiKey, hashApiKey } from "../lib/api-key.ts"` (`../../lib/api-key.ts` from `test-seed/`). Insert `api_key_hash: hashApiKey(key)` instead of `api_key`. Change `.select(...api_key)` to `.select("id, name")`. Print the plain key from the local variable once, so a dev can configure a Pi. Leave factories' `api_key` alone.

**Step 5: `scripts/test-validation.ts`.** Update the `chk_centers_api_key` assertion/message to `chk_centers_api_key_hash` (64 hex). Remove `api_key` from `centerSchema` in `app/centers/types.ts`, then grep for other users: `grep -rn "api_key" app components lib scripts`.

**Step 6:** `pnpm type-check && pnpm exec oxfmt <touched .ts files>`. Then check the SQL syntax without touching any DB. If `postgres` is available locally, run `psql --set ON_ERROR_STOP=1 -c 'BEGIN' -f schema.sql -c 'ROLLBACK'` against a **throwaway** DB only. Otherwise, review the SQL by eye and say so. Report the diff. Don't commit.

---

### Task 3: Proxy pass-through and `POST /api/entries`

**Skills:** @ponytail + @api-security-best-practices
**Depends on:** T1 (`parseBasicAuth`, `lib/api-key.ts`) and T2 (`api_key_hash` column)

**Files:**
- Modify: `proxy.ts:18`
- Create: `app/api/entries/route.ts`

**Step 1: proxy.ts.** Change line 18 to:

```ts
  // Device ingest authenticates itself (HTTP Basic center_id:api_key) inside the route.
  const isPublicAuthApi =
    pathname === "/api/auth/login" || (pathname === "/api/entries" && request.method === "POST");
```

Nothing else changes. The early return already passes `stripSessionHeaders` output. `/api/entries/automatic` and `/api/entries/manual` stay session-gated because the comparison is an exact `===`.

**Step 2: route.** Create `app/api/entries/route.ts`:

```ts
import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { LRUCache } from "lru-cache";
import { supabase } from "@/lib/supabase";
import { parseBasicAuth } from "@/lib/security";
import { apiKeyMatches, DUMMY_KEY_HASH } from "@/lib/api-key";
import { vehicleNumberSchema } from "@/lib/validation/helpers";

const BUCKET = "mesto";
const NO_PLATE = "NO_PLATE_DETECTED";
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ENTRIES_PER_MINUTE = 30;
// ponytail: per-instance fixed window; move to a DB/Redis counter if instances scale out.
const recentEntries = new LRUCache<number, number>({ max: 10_000, ttl: 60_000, noUpdateTTL: true });

const json = (body: unknown, status: number) => NextResponse.json(body, { status });
const UNAUTHORIZED = () =>
  NextResponse.json(
    { error: "Unauthorized" },
    { status: StatusCodes.UNAUTHORIZED, headers: { "WWW-Authenticate": 'Basic realm="janus"' } },
  );

const entrySchema = z.object({
  center_id: z.coerce.number().int().positive().optional(),
  detected_vehicle_number: z.preprocess(
    (v) => (typeof v === "string" && /^\s*(NO_PLATE_DETECTED|REJECTED_\w*)\s*$/i.test(v) ? NO_PLATE : v),
    z.union([z.literal(NO_PLATE), vehicleNumberSchema]),
  ),
  weight: z.coerce.number().positive().max(99_999_999.99), // DECIMAL(10, 2)
});

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : undefined;
};

export async function POST(request: Request) {
  try {
    const creds = parseBasicAuth(request.headers.get("authorization"));
    const centerId = creds && /^\d{1,9}$/.test(creds.id) ? Number(creds.id) : 0;
    if (!creds || !centerId) return UNAUTHORIZED();

    const { data: center, error: centerError } = await supabase
      .from("centers")
      .select("id, factory_id, api_key_hash")
      .eq("id", centerId)
      .maybeSingle();
    if (centerError) throw centerError;
    // Unknown center and wrong key run the same compare and return the same 401.
    if (!apiKeyMatches(creds.key, center?.api_key_hash ?? DUMMY_KEY_HASH) || !center) {
      return UNAUTHORIZED();
    }

    const count = recentEntries.get(center.id) ?? 0;
    if (count >= MAX_ENTRIES_PER_MINUTE) {
      return json({ error: "Too many requests." }, StatusCodes.TOO_MANY_REQUESTS);
    }
    recentEntries.set(center.id, count + 1);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Expected multipart/form-data." }, StatusCodes.BAD_REQUEST);
    }

    const parsed = entrySchema.safeParse({
      center_id: field(form, "center_id"),
      detected_vehicle_number: field(form, "detected_vehicle_number"),
      weight: field(form, "weight"),
    });
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0].message }, StatusCodes.BAD_REQUEST);
    }
    const { center_id: claimedCenter, detected_vehicle_number: plate, weight } = parsed.data;
    if (claimedCenter !== undefined && claimedCenter !== center.id) {
      return json({ error: "center_id does not match credentials." }, StatusCodes.FORBIDDEN);
    }

    // Hermes's storage fallback re-sends one zero-byte file: treat it as "no images".
    const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_IMAGES) {
      return json({ error: `At most ${MAX_IMAGES} images.` }, StatusCodes.BAD_REQUEST);
    }
    if (files.some((f) => f.type !== "image/jpeg" || f.size > MAX_IMAGE_BYTES)) {
      return json({ error: "Images must be JPEG and at most 5 MB." }, StatusCodes.BAD_REQUEST);
    }
    const bodies = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));

    // Same photos + plate + weight from the same center = a retried request (Hermes retries on timeout).
    const idempotencyKey = bodies.length
      ? createHash("sha256")
          .update(`${center.id}|${plate}|${weight}|`)
          .update(bodies.map((b) => createHash("sha256").update(b).digest("hex")).join(","))
          .digest("hex")
      : randomUUID();

    const images: string[] = [];
    for (const [i, body] of bodies.entries()) {
      const path = `${center.factory_id}/automatic/${center.id}/${idempotencyKey}_${i}.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, body, { contentType: "image/jpeg", upsert: true });
      if (error) {
        console.error("Ingest image upload failed:", error);
        // Hermes matches "storage" in a 400 body and retries without images.
        return json({ error: "Image storage failed." }, StatusCodes.BAD_REQUEST);
      }
      images.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }

    const { data: entry, error: insertError } = await supabase
      .from("automatic_entries")
      .insert({ center_id: center.id, vehicle_number: plate, weight, images, idempotency_key: idempotencyKey })
      .select("id")
      .single();

    if (insertError?.code === "23505") {
      const { data: existing, error } = await supabase
        .from("automatic_entries")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .single();
      if (error) throw error;
      return json({ data: { id: existing.id } }, StatusCodes.OK);
    }
    if (insertError?.code === "23514") {
      return json({ error: "Entry failed validation." }, StatusCodes.BAD_REQUEST);
    }
    if (insertError) throw insertError;

    return json({ data: { id: entry.id } }, StatusCodes.CREATED);
  } catch (error) {
    console.error("Device ingest failed:", error);
    return json({ error: "Internal Server Error" }, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}
```

Before finalising, check three things:
- (a) What `images` in `automatic_entries` holds elsewhere: `scripts/test-seed/entries.ts:249` stores resolved public URLs, so this route does the same. Confirm the mesto bucket is public in `schema.sql:746`.
- (b) Whether `insert` needs `updated_at`.
- (c) That nothing else in `app/api/entries/` exports `POST` (`route.ts` must be new).

**Step 3:** `pnpm type-check && pnpm lint && pnpm exec oxfmt proxy.ts app/api/entries/route.ts && pnpm test`. Expected: all green. Report the diff. Don't commit.

---

### Task 4: Admin key rotation and README

**Skills:** @ponytail + @secrets-management
**Depends on:** T1, T2

**Files:**
- Create: `app/api/centers/rotate-key/route.ts`
- Modify: `README.md` (Hermes / device ingest section)

**Step 1: endpoint.** It is admin-only. The plain key is returned once with `no-store`, and only its hash is saved:

```ts
import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { generateApiKey, hashApiKey } from "@/lib/api-key";
import { handleApiRoute, ServiceError, type ApiContext } from "@/lib/api-handler";
import { ADMIN } from "@/lib/security";

const rotateSchema = z.object({ id: z.int().positive() }).strict();

export const POST = handleApiRoute(
  async (request: Request, context: ApiContext) => {
    const validation = rotateSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: StatusCodes.BAD_REQUEST });
    }

    const apiKey = generateApiKey();
    const { data, error } = await supabase
      .from("centers")
      .update({ api_key_hash: hashApiKey(apiKey), updated_at: new Date().toISOString() })
      .eq("id", validation.data.id)
      .eq("factory_id", context.factory.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Center key rotation failed:", error);
      throw new ServiceError("Failed to rotate key.", StatusCodes.INTERNAL_SERVER_ERROR);
    }
    if (!data) {
      return NextResponse.json({ error: "Center not found." }, { status: StatusCodes.NOT_FOUND });
    }

    // Shown once: only the hash is stored. The old key stops working immediately.
    return NextResponse.json(
      { data: { id: data.id, api_key: apiKey } },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { roles: ADMIN },
);
```

Check `lib/api-handler.ts` for whether `handleApiRoute` catches a malformed JSON body as 400. If it doesn't, wrap `request.json()` the way the login route does. Confirm that `proxy.ts` gates `/api/centers/rotate-key` behind a session (it does: only the exact paths above are public).

**Step 2: README.** Add a short "Device ingest (Hermes)" section covering:
- The endpoint and its auth: Basic `center_id:api_key`.
- The Hermes license values: `device_id` = center id, `device_key` = the key.
- Issuing a key from the browser console while logged in as admin: `await (await fetch("/api/centers/rotate-key",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:1})})).json()`.
- A SQL fallback: generate locally with `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`, then `UPDATE public.centers SET api_key_hash = encode(sha256(convert_to('<key>','UTF8')),'hex'), updated_at = now() WHERE id = <id>;`. Note that the key then sits in the SQL history.
- The responses: 201/200/400/401/403/429/500.

No new env vars.

**Step 3:** `pnpm type-check && pnpm lint && pnpm exec oxfmt app/api/centers/rotate-key/route.ts`. Report the diff. Don't commit.

---

### Task 5: End-to-end check with a Hermes-shaped curl

**Skills:** @ponytail + @hunt-auth-bypass
**Depends on:** T1–T4 in the working tree

**DB (user decides before dispatch):**
- **(A, recommended)** First `pg_dump` the local `supabase-local` DB to `../backups/supabase-local-before-ingest-$(date +%Y%m%d-%H%M%S).sql`. Then apply only the T2 migration snippet (not the whole `schema.sql`) with `psql -v ON_ERROR_STOP=1`. Additive and backfilled; reversible from the dump.
- **(B)** A separate throwaway Supabase stack on other ports (`supabase start` in a scratch dir, then `schema.sql` + `scripts/test-seed`). Leaves master data untouched; slower to set up.

**Steps** (dev server on port 3100 from this worktree; copy the main checkout's `.env` in, and never print it):
1. Pick a center `N`. Set its key directly in SQL with a generated `$KEY`, the README fallback; this also exercises the documented path.
2. Valid request. Expect `201` and `{"data":{"id":…}}`:
   ```bash
   curl -s -w '\n%{http_code}\n' -u "N:$KEY" --form-string center_id=N --form-string detected_vehicle_number=MH12AB1234 --form-string weight=18540.5 -F "file=@/path/to/sample.jpg;type=image/jpeg" http://localhost:3100/api/entries
   ```
3. The same request again. Expect `200` with the same id (idempotent).
4. `-u "N:wrong"` and `-u "999999:$KEY"`. Expect `401` with identical bodies for both.
5. `--form-string center_id=<other id>`. Expect `403`.
6. `detected_vehicle_number=NO_PLATE_DETECTED`. Expect `201`. `detected_vehicle_number=garbage`. Expect `400`.
7. A zero-byte `file` part (Hermes fallback). Expect `201` with `images = {}`.
8. Auth probing: no `Authorization` header, then `-H 'x-user-role: admin'` with a bad key. Expect `401` for both. `GET /api/entries` and `GET /api/entries/automatic` without a cookie. Expect `401` for both (still session-gated).
9. Confirm with SQL that the row exists, the image object is in `mesto`, and `centers` has no `api_key` column.
10. Clean up the test rows and objects you created. Stop the dev server.

Report the full status-code table. Don't commit.

---

### Final: verification loop (main session)

**Skills:** @ponytail + @verification-loop

1. Review each subagent diff against this plan. Check that every changed line traces back to the brief.
2. `PATH=/opt/homebrew/bin:$PATH pnpm type-check && pnpm lint && pnpm exec oxfmt --check <all touched files> && pnpm test`. Loop until 0 errors and 0 warnings. **No `pnpm build`, no bare `pnpm fmt`.**
3. Grep gates, each expected to return nothing:
   - `grep -rn "sharp" app lib`
   - `grep -rln "argon2" app lib | grep -v lib/password.ts`
   - `grep -rn "process.env" app/api/entries lib/api-key.ts`
   - `grep -rn "api_key[^_]" app lib components` (factories' columns excepted)
4. Commit on `feat/hermes-device-ingest`, only the files this plan touched (`git add <paths>`), with message `feat: device ingest POST /api/entries with hashed center keys`. Don't push. Hand the branch to the parent to merge into `fix/security-and-pr9-port`.
