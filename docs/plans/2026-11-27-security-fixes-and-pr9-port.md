# Security Fixes + PR #9 Port Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to implement this plan task-by-task. Each subagent loads **`ponytail`** + the task's **special skill** (named in the task header), executes only its task, and commits. The orchestrator reviews between tasks. Final gate: **`verification-loop`** (Task 11, run by the orchestrator).

**Goal:** Close every finding from the 2026-11-27 security audit of `migration` (C1–L3), then port PR #9's theme and realtime notification bell from `master` onto migration's `automatic_*` / `manual_*` tables.

**Architecture:** The database is locked to the service role: RLS is on, anon and authenticated get no grants, and the RPCs are revoked. Authorization lives in one place, `handleApiRoute(handler, { roles })`. Pure security helpers live in `lib/security.ts` (no `@/` imports), so `node --experimental-strip-types` can test them. Password hashing goes through one file, `lib/password.ts`, and the Supabase client is created on first use rather than at import, so neither does work at module scope. Notifications are a port, not a merge: master's `entries`/`weighments` triggers are re-pointed at the four migration tables in a new `realtime.sql`.

**Tech Stack:** Next.js 16 (`proxy.ts`) on Vercel/Node, Supabase Postgres (service-role client, Realtime Broadcast), zod 4, argon2 (behind `lib/password.ts`), lru-cache, Tailwind 4 + shadcn on base-ui (`@base-ui/react`), zustand 5, TypeScript 7, oxlint + oxfmt. Tests: `node --experimental-strip-types` for `scripts/test-*.ts`, plus **Vitest 5 + happy-dom + Testing Library** for components (Task 10, same setup as `origin/master` and `../janus`).

**Branch:** `git switch -c fix/security-and-pr9-port` from `migration` (fad8fcc2). One commit per task.

**Checks after every task:** `pnpm type-check`, `pnpm lint`, `pnpm exec oxfmt <changed files>`, `pnpm test`. Target: 0 errors and 0 warnings. Never run `pnpm build` (it hangs in the sandbox) or bare `pnpm fmt` (it checks `docs/shadcn`).

---

## Architectural Alignment & Shift Rationale

We looked at moving argus + hermes + janus onto the VoidZero / Cloudflare stack. This plan keeps what already lines up, adopts the two pieces that pay off now, and makes zero-regret fixes so a later Workers move doesn't start with a rewrite. **Next.js is not replaced in this plan.**

**Kept (already aligned):** React 19, Tailwind 4, Base UI, Zustand `^5.1.0`, Oxlint `^1.94.0`, Oxfmt `^0.79.0`, TypeScript `^7.0.2`, and **PostgreSQL via Supabase**. D1/SQLite isn't an option: `schema.sql` relies on stored generated columns (`net … GENERATED ALWAYS AS`, lines 162/187), `security_invoker` views (lines 210–280), triggers (`trg_invalidate_sessions`, `trg_*_auto_populate`), RPCs (`correct_automatic_weighment_plate`, `soft_delete_automatic_weighment`) and RLS (Task 1).

**Added now:**

- **Vitest + happy-dom** (Task 10). This reverses the earlier "skip the bell test" call. `origin/master` and `../janus` already run `vitest run` with `happy-dom` and `@testing-library/react` (`vitest.config.ts`, `vitest.setup.ts`), and the bell's subscribe/refresh effect is too risky to leave covered by a manual check only.
- **Workers-portability safeguards.** These cost nothing on Node/Vercel today:
  - `lib/password.ts` is the only file that imports `argon2` (Task 5).
  - `DUMMY_HASH` is a static string, not `argon2.hash()` at module scope (Task 5).
  - `lib/supabase.ts` reads env and calls `createClient` on first use, not at import (Task 2).
  - There is no `.env.example`; env names live in `README.md` (Task 9).

**Deferred or rejected (non-goals):**

- **`vinext` / `voidPlugin()` (void.cloud): deferred.** Both are experimental, and `argon2` is a native Node-API addon that won't load on Workers. Ship this plan on Next.js 16 first, then evaluate Void native or `vinext` as its own project. (The vinext-adapter status and Void's `.env.example` check come from the architecture review. The Void docs aren't checked out locally, so they weren't re-verified here.)
- **`fate` and Redux: rejected.** Janus is server-paginated, filtered and sorted SQL views returning `{ data, totalCount }`, plus Realtime Broadcast. There's no normalized object graph for Relay-style caching to help with, and Zustand already covers the client state.
- **`tsrs`: rejected.** Keep `typescript ^7.0.2` (`tsc` in `type-check`).
- **D1: rejected** (see Kept above).
- **`sharp` in janus-migration: never.** `../janus/lib/services/image-processor.ts` uses it, but Hermes already compresses on the Pi (`../hermes/src/services/image_compressor.py`, opencv-python). Any camera-frame cropping for future `POST /api/entries` ingest belongs in Hermes. That keeps this app free of native `libvips` and ready for R2 storage later.

---

## Decisions taken as defaults (confirm D1, D6 before Task 2; D5 before Task 5; D2 before Task 8; D7 before Task 10)

D5–D7 approved by the user on 2026-11-27.

| #   | Decision                      | Default                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Role matrix                   | All authenticated users can GET. **admin** can write users and factory settings, and delete weighments. **admin and manager** can edit centers and correct plates.                                                                                                                                                                                                              |
| D2  | `base` role and notifications | No bell for `base`. Only admin, manager and operator join `factory:<id>`, because migration has no customers table, so the `user:<id>` topic is dropped.                                                                                                                                                                                                                        |
| D3  | Photo bucket                  | Stays `public` (URLs keep working). All `storage.objects` policies are dropped, so anon can't list or write. Signed URLs come later.                                                                                                                                                                                                                                            |
| D4  | Session lifetime              | 12h absolute, measured from `sessions.created_at`. No schema change.                                                                                                                                                                                                                                                                                                            |
| D5  | Password hashing boundary     | Only `lib/password.ts` imports `argon2`. It's copied from master's `lib/auth/password.ts`: `hashPassword(password)` and `verifyPassword(password, storedHash)`, which returns `false` rather than throwing. It also exports a static `DUMMY_HASH`. A Workers port then means rewriting one file to a WASM Argon2id package, with existing `$argon2id$…` hashes still verifying. |
| D6  | Env / Void compatibility      | No module-scope env reads or client construction. `lib/supabase.ts` builds the client on first property access behind a Proxy, so the 8 importers don't change. Env names are documented in `README.md`; **no `.env.example`**. `scripts/supabase.ts` (CLI only, uses `process.loadEnvFile`) is out of scope.                                                                   |
| D7  | Component tests               | Vitest 5 + happy-dom + Testing Library, with the versions and config copied from `origin/master`. `pnpm test` runs the node suites, then `vitest run`. `pnpm test:ui` runs only the Vitest suite.                                                                                                                                                                               |

## Skill map (from skill-scout, all local)

| Task | Scope                                                             | Special skill                      |
| ---- | ----------------------------------------------------------------- | ---------------------------------- |
| 1    | C1–C3 DB/storage lockdown                                         | `supabase-postgres-best-practices` |
| 2    | C4 RBAC guard + test harness + lazy Supabase client (D6)          | `api-security-best-practices`      |
| 3    | H1–H2 session expiry/revocation                                   | `hunt-session`                     |
| 4    | H3 proxy header spoofing                                          | `hunt-nextjs`                      |
| 5    | M1–M5 injection, redirect, login, errors + `lib/password.ts` (D5) | `owasp-security`                   |
| 6    | L1–L3 headers, re-auth, deps                                      | `security-best-practices`          |
| 7    | PR #9 theme port                                                  | `shadcn` (+ read `docs/shadcn`)    |
| 8    | Notifications SQL (re-pointed)                                    | `supabase-postgres-best-practices` |
| 9    | Notifications + realtime token API + env docs                     | `nextjs-best-practices`            |
| 10   | Notification bell UI + Vitest bell test                           | `react-useeffect`                  |
| 11   | Final gate (orchestrator)                                         | `verification-loop`                |

No task's special skill changed, so skill-scout wasn't re-run. The new work fits within each task's existing skill.

Task 7 touches no file that Tasks 1–6 touch, so it can run in parallel with them. Everything else runs in order.

---

### Task 1: Lock down DB, RPCs and storage (C1, C2, C3)

**Skill:** `supabase-postgres-best-practices`

**Files:**

- Modify: `schema.sql`. Add a DROP for `notifications` to the cleanup block (§0), replace §7 storage policies, and append §8.

**Step 1: Add the `notifications` drop to §0** (right after `DROP TABLE IF EXISTS public.sessions CASCADE;`), so re-running `schema.sql` stays idempotent once Task 8 lands:

```sql
DROP TABLE IF EXISTS public.notifications CASCADE;
```

**Step 2: Replace the four `CREATE POLICY … mesto` blocks in §7 with drops only.** The service role bypasses RLS, so the server needs no policy. A public bucket serves public URLs without one.

```sql
-- Service role bypasses RLS; no policy = anon/authenticated can't list, upload, overwrite or delete.
-- ponytail: bucket stays public so stored photo URLs work; move to signed URLs if photos become sensitive.
DROP POLICY IF EXISTS "Allow read access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow update access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete access for mesto bucket" ON storage.objects;
```

**Step 3: Append §8 before `NOTIFY pgrst`:**

```sql
-- ----------------------------------------------------------------------------
-- 8. Access Lockdown. The server uses the service role (bypasses RLS and grants).
-- anon/authenticated (publishable key, Realtime tokens) get nothing in public.
-- Re-run after adding any table or function.
-- ----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.name);
  END LOOP;
  FOR r IN SELECT viewname AS name FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.name);
  END LOOP;
  FOR r IN
    SELECT p.oid::regprocedure AS fn FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fn);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
```

**Step 4: Verify on a local or staging Supabase, never prod first.** Apply `schema.sql`, then use the **publishable** key:

```bash
curl -s "$SUPABASE_URL/rest/v1/users?select=password_hash" -H "apikey: $SUPABASE_PUBLISHABLE_KEY"
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/soft_delete_automatic_weighment" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{"p_weighment_id":1,"p_factory_id":1}'
curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/mesto" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Authorization: Bearer $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{"prefix":""}'
```

Expected: a `permission denied` / 401 error (or `[]`) for the first two, and `[]` for the list. The app still logs in and lists weighments, because it uses the secret key.

**Step 5: Commit:** `fix: enable RLS, revoke anon grants and RPC execute, drop open storage policies`

> ⚠️ Deploy order: confirm the Vercel env has `SUPABASE_SECRET_KEY` set to the secret or service-role key **before** running this SQL. `scripts/supabase.ts` falls back to the publishable key, so seeding with only that key fails afterwards. That's expected.

---

### Task 2: Role guard in the shared wrapper + security test harness (C4)

**Skill:** `api-security-best-practices`

**Files:**

- Create: `lib/security.ts` (pure, no `@/` imports, testable by node)
- Create: `scripts/test-security.ts`
- Modify: `package.json` (`test` script), `lib/api-handler.ts`, `lib/auth.ts` (move `SESSION_HEADER_KEYS`), `lib/supabase.ts` (lazy client, D6), and every write route: `app/api/users/route.ts`, `app/api/factories/route.ts`, `app/api/centers/route.ts`, `app/api/weighments/automatic/route.ts`

**Step 1: Create `lib/security.ts`.** This task only adds the header key list and a role constant. Tasks 4 and 5 add more.

```ts
/**
 * @file lib/security.ts
 * @description Dependency-free security helpers (importable from proxy, client and node tests).
 */
import type { UserRole } from "@/app/users/types"; // type-only: erased under strip-types

export const SESSION_HEADER_KEYS = [
  "x-user-id",
  "x-factory-id",
  "x-user-role",
  "x-user-name",
  "x-user-username",
  "x-user-created-at",
  "x-user-updated-at",
  "x-factory-name",
  "x-factory-receipt-images",
  "x-factory-created-at",
  "x-factory-updated-at",
] as const;

export const ADMIN: readonly UserRole[] = ["admin"];
export const ADMIN_MANAGER: readonly UserRole[] = ["admin", "manager"];
export const NOTIFY_ROLES: readonly UserRole[] = ["admin", "manager", "operator"];
```

In `lib/auth.ts`, delete the local `SESSION_HEADER_KEYS` array and replace it with `import { SESSION_HEADER_KEYS } from "@/lib/security";` plus `export { SESSION_HEADER_KEYS };`, so existing importers keep working.

**Step 2: Write the failing harness, `scripts/test-security.ts`:**

```ts
import assert from "node:assert/strict";
import { SESSION_HEADER_KEYS, ADMIN, NOTIFY_ROLES } from "../lib/security.ts";

assert.equal(SESSION_HEADER_KEYS.length, 11);
assert.deepEqual(ADMIN, ["admin"]);
assert.ok(!NOTIFY_ROLES.includes("base"));
console.log("✓ security helpers");
```

Change `package.json` `"test"` to:
`"node --experimental-strip-types scripts/test-validation.ts && node --experimental-strip-types scripts/test-security.ts"`

Run: `pnpm test`. It FAILS before Step 1 exists and PASSES after.

**Step 3: Add the guard to `handleApiRoute`** (`lib/api-handler.ts`). This is the single choke point, so callers don't each repeat the check:

```ts
import type { User, UserRole } from "@/app/users/types";

export function handleApiRoute(
  handler: (request: Request, context: ApiContext) => Promise<NextResponse>,
  options: { roles?: readonly UserRole[] } = {},
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    try {
      const session = getAuthSession(request);
      if (options.roles && !options.roles.includes(session.user.role)) {
        throw new AuthError("Forbidden", StatusCodes.FORBIDDEN);
      }
      return await handler(request, { user: session.user, factory: session.factory });
    } catch (err: unknown) {
      // …existing catch unchanged (Task 5 rewrites it)
    }
  };
}
```

**Step 4: Apply D1 by passing `{ roles }` as the second argument.**

- `app/api/users/route.ts`: `POST`, `PATCH`, `DELETE` use `ADMIN`.
- `app/api/factories/route.ts`: `PATCH` uses `ADMIN`.
- `app/api/centers/route.ts`: `PATCH` uses `ADMIN_MANAGER`.
- `app/api/weighments/automatic/route.ts`: `PATCH` uses `ADMIN_MANAGER`. `DELETE` uses `ADMIN`, and the inline `if (context.user.role !== "admin")` block is deleted.
- GETs, `/api/users/me` and `/api/auth/logout` stay open to any session.

**Step 5:** Run `grep -rn "handleApiRoute(" app/api`. Every non-GET handler apart from `me` and `logout` must now pass roles.

**Step 6: Write the failing lazy-client test** (D6; append to `scripts/test-security.ts`). Today `lib/supabase.ts` reads `process.env.SUPABASE_URL!` / `SUPABASE_SECRET_KEY!` and calls `createClient` at import. The test fails because the import itself creates the client, so the access below doesn't throw:

```ts
import { supabase } from "../lib/supabase.ts"; // importing must not read env or build a client

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
assert.throws(() => supabase.from("users"), /SUPABASE_URL and SUPABASE_SECRET_KEY/);
console.log("✓ supabase client is lazy");
```

Run: `pnpm test`. Expected: FAIL (`Missing expected exception`).

**Step 7: Make `lib/supabase.ts` lazy.** Replace the whole file with the block below. All 8 importers keep `supabase.from(…)` / `.rpc(…)` unchanged (`grep -rln '@/lib/supabase"' app lib components`):

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/** Built on first use, never at import: no module-scope env read (Vite/Workers-safe). */
function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  return (client = createClient(url, key));
}

// Proxy keeps every existing `supabase.x` call site; methods are bound to the real client.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
```

Run: `pnpm test`. Expected: PASS, printing `✓ supabase client is lazy`. Then `pnpm dev`: log in and list weighments, which proves the proxied client works end to end.

**Step 8:** Run the checks, then commit: `fix: enforce role-based access in handleApiRoute; build supabase client lazily`

---

### Task 3: Session expiry and real revocation (H1, H2, M4)

**Skill:** `hunt-session`

**Files:** `lib/auth.ts`, `app/api/users/service.ts`, `app/api/auth/login/route.ts`

**Step 1: Make sessions expire and bound the cache's staleness** (`lib/auth.ts`):

```ts
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // D4
const CACHE_TTL_MS = 60_000;

// ponytail: per-instance cache; a revoked session lives ≤60s on other instances. Shared cache if that's too long.
const sessionCache = new LRUCache<string, SessionData>({ max: 5000, ttl: CACHE_TTL_MS });

export function sessionCutoffIso(): string {
  return new Date(Date.now() - SESSION_TTL_SECONDS * 1000).toISOString();
}
```

In `getSessionUser`, add `.gt("created_at", sessionCutoffIso())` after `.eq("token_hash", tokenHash)`.

**Step 2: Revoke instead of patching.** Delete `updateUserSessionCache` from `lib/auth.ts`. In `app/api/users/service.ts` `updateUserAccount`, replace the `if (password…) invalidate… else update…` block with:

```ts
// DB trigger trg_invalidate_sessions deletes rows on role/username/password change; drop cached copies too.
invalidateAllUserSessionCache(updated.id);
```

Then fix the import. Without this, a demoted admin keeps the cached session with the new role, but the DB rows are already gone.

**Step 3: Login** (`app/api/auth/login/route.ts`):

- Add `.is("deleted_at", null)` to the users lookup (M4).
- Add `maxAge: SESSION_TTL_SECONDS` to `response.cookies.set`.
- Right after `createSession`, prune this user's expired rows:

```ts
await supabase
  .from("sessions")
  .delete()
  .eq("user_id", user.id)
  .lt("created_at", sessionCutoffIso());
```

**Step 4: Verify by hand on the dev server** (`pnpm dev`):

- Log in.
- In SQL, run `UPDATE sessions SET created_at = now() - interval '13 hours'`.
- Wait 60s (cache TTL) and refresh. You should be redirected to `/login`.
- Change a user's role as admin. That user's next request after 60s should get a 401.

**Step 5:** Run the checks, then commit: `fix: expire sessions after 12h and revoke cached sessions on account change`

---

### Task 4: Strip client-supplied identity headers in the proxy (H3)

**Skill:** `hunt-nextjs`

**Files:** `lib/security.ts`, `proxy.ts`, `scripts/test-security.ts`

**Step 1: Write the failing test** (append to `scripts/test-security.ts`):

```ts
import { stripSessionHeaders } from "../lib/security.ts";

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
```

Run: `pnpm test`. It FAILS because `stripSessionHeaders` isn't exported.

**Step 2: Implement it** in `lib/security.ts`:

```ts
/** Copy of `headers` without any identity header a client could forge. */
export function stripSessionHeaders(headers: Headers): Headers {
  const clean = new Headers(headers);
  for (const key of SESSION_HEADER_KEYS) clean.delete(key);
  clean.delete("x-pathname");
  return clean;
}
```

**Step 3: Use it on every path in `proxy.ts`.**

- On the first line of `proxy()`, add `const requestHeaders = stripSessionHeaders(request.headers);`.
- Replace both `new Headers(request.headers)` with `requestHeaders`.
- Change the public early return to `return NextResponse.next({ request: { headers: requestHeaders } });`.
- Delete `isPublicAutomaticIngest`. It has no POST handler, so it's dead unauthenticated surface. Re-add it with Basic/API-key auth when device ingest actually lands.

**Step 4:** `pnpm test` passes. Manual check:

```bash
curl -s -X POST localhost:3000/api/auth/login -H "x-user-id: 1" -H "x-factory-id: 1" -H "x-user-role: admin" -H "Content-Type: application/json" -d '{}'
```

This must return a validation 400, with no identity accepted.

**Step 5:** Run the checks, then commit: `fix: strip forged x-user headers on every proxy path`

---

### Task 5: Filter injection, open redirect, login hardening, error leakage (M1, M2, M3, M5)

**Skill:** `owasp-security`

**Files:**

- Create: `lib/password.ts` (D5; imports only `argon2`, no `@/`, so node tests can load it)
- Modify: `lib/security.ts`, `scripts/test-security.ts`, `lib/api-query.ts`, `proxy.ts`, `components/login-form.tsx`, `app/api/auth/login/route.ts`, `app/api/users/service.ts`, `scripts/seed.ts`, `scripts/test-seed/users.ts`, `lib/api-handler.ts`, plus every `app/api/**` site from Step 10's grep

**Step 1: Write the failing tests** (append):

```ts
import { safeNextPath, quotePostgrestValue } from "../lib/security.ts";

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
```

Run `pnpm test`. It FAILS.

**Step 2: Implement** in `lib/security.ts`:

```ts
/** Same-origin relative path or "/". Blocks //host, /\host, schemes. */
export function safeNextPath(next: string | null | undefined): string {
  return next && /^\/(?![\\/])/.test(next) ? next : "/";
}

/** Quote a value for PostgREST or()/in() so , . : ( ) can't start a new filter. */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}
```

**Step 3: Write the failing password-boundary test** (append to `scripts/test-security.ts`):

```ts
import { hashPassword, verifyPassword, DUMMY_HASH } from "../lib/password.ts";

const fresh = await hashPassword("pw-123");
assert.ok(fresh.startsWith("$argon2id$"));
assert.equal(await verifyPassword("pw-123", fresh), true);
assert.equal(await verifyPassword("nope", fresh), false);
assert.equal(await verifyPassword("x", "not-a-hash"), false); // never throws
// DUMMY_HASH: static, same cost params as real hashes → the missing-user path takes as long as a wrong password.
const params = (h: string) => h.split("$").slice(1, 4).join("$"); // argon2id$v=19$m=…,t=…,p=…
assert.equal(params(DUMMY_HASH), params(fresh));
assert.equal(await verifyPassword("wrong", DUMMY_HASH), false);
console.log("✓ password boundary");
```

Run: `pnpm test`. Expected: FAIL (`Cannot find module … lib/password.ts`).

**Step 4: Create `lib/password.ts`.** The body is master's `lib/auth/password.ts` (`git show origin/master:lib/auth/password.ts`), plus `DUMMY_HASH`. Generate the constant once (after `pnpm install`) and paste the printed string in:

```bash
node --input-type=module -e 'import a from "argon2"; console.log(await a.hash("timing-equaliser", { type: a.argon2id }))'
```

```ts
/**
 * @file lib/password.ts
 * @description The only argon2 import in the app (D5). Workers/Void port = swap this file to a WASM
 * Argon2id package; stored `$argon2id$…` hashes stay valid.
 */
import argon2 from "argon2";

/**
 * Static Argon2id hash of a throwaway string. Login verifies against it when the username doesn't
 * exist, so both failure paths cost the same. A literal on purpose: hashing at module scope
 * (64 MiB + RNG) is slow on cold start and not allowed in a Workers global scope.
 */
export const DUMMY_HASH = "<paste the $argon2id$v=19$m=65536,t=3,p=4$… output here>";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/** false on mismatch or malformed hash; never throws. */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, password);
  } catch {
    return false;
  }
}
```

Run: `pnpm test`. Expected: PASS, printing `✓ password boundary`.

**Step 5: Route every caller through it**, so `argon2` appears only in `lib/password.ts`:

- `app/api/users/service.ts`: drop `import argon2 from "argon2";`, add `import { hashPassword } from "@/lib/password";`, and change both `argon2.hash(password.trim())` (lines 53, 92) to `hashPassword(password.trim())`.
- `scripts/seed.ts`: change the import to `import { hashPassword } from "../lib/password.ts";`, and line 190 to `await hashPassword(args.admin_password)`.
- `scripts/test-seed/users.ts`: change the import to `import { hashPassword } from "../../lib/password.ts";`, and the four `argon2.hash(…)` calls to `hashPassword(…)`.
- `app/api/auth/login/route.ts`: handled in Step 8.

Check: `grep -rn "argon2" app lib scripts components | grep -v "lib/password.ts"`. Expected after Step 8: no output.

**Step 6: M1 in `lib/api-query.ts`.**

- In the ilike loop, push ``${col}.ilike.${quotePostgrestValue(`%${search}%`)}``.
- Delete the `conditions.length === 1` split special case. Always use `query = query.or(conditions.join(","))` when `conditions.length > 0`. The split breaks on quoted values, and one OR term is equivalent anyway.
- The integer, numeric and enum terms are already regex- or allowlist-gated, so leave them as they are.

Manual check: `GET /api/users?search=x,password_hash.like.*a*` returns `[]` rows rather than matches.

**Step 7: M2.**

- `components/login-form.tsx`: change to `const nextUrl = safeNextPath(searchParams.get("next"));`.
- `proxy.ts:72`: change to `const nextUrl = safeNextPath(request.nextUrl.searchParams.get("next"));`. This deletes the duplicated inline check.

**Step 8: M3 in `app/api/auth/login/route.ts`.** Replace `import argon2 from "argon2";` with the imports below. Nothing here hashes at module scope; `DUMMY_HASH` is the static literal from Step 4.

```ts
import { LRUCache } from "lru-cache";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";

const MAX_FAILED_LOGINS = 5;
// ponytail: per-instance counter; move to a DB/Redis counter if instances scale out.
const failedLogins = new LRUCache<string, number>({ max: 10_000, ttl: 15 * 60_000 });
const INVALID = "Invalid username or password.";
```

Inside `POST`, after validation:

```ts
if ((failedLogins.get(username) ?? 0) >= MAX_FAILED_LOGINS) {
  return NextResponse.json(
    { error: "Too many attempts. Try again in 15 minutes." },
    { status: StatusCodes.TOO_MANY_REQUESTS },
  );
}
// …users lookup…
const isValidPassword = user
  ? await verifyPassword(password, user.password_hash)
  : (await verifyPassword(password, DUMMY_HASH), false);
if (!user || !isValidPassword) {
  failedLogins.set(username, (failedLogins.get(username) ?? 0) + 1);
  return NextResponse.json({ error: INVALID }, { status: StatusCodes.UNAUTHORIZED });
}
failedLogins.delete(username);
```

This replaces both the "User not found." and "Incorrect password." branches.

**Step 9: M5, generic 5xx in one place** (`lib/api-handler.ts` catch):

```ts
if (err instanceof AuthError) {
  return NextResponse.json({ error: err.message }, { status: err.statusCode });
}
if (err instanceof ServiceError && err.statusCode < 500) {
  return NextResponse.json({ error: err.message }, { status: err.statusCode });
}
console.error("API error:", err);
return NextResponse.json(
  { error: "Internal Server Error" },
  { status: StatusCodes.INTERNAL_SERVER_ERROR },
);
```

**Step 10:** Remove the remaining leaks found by:

```bash
grep -rnE "error: (\w+\.)?(message|error\.message)|err\.message|insertError\.message|updateError\.message|deleteErr\.message" app/api lib
```

- Replace each 500 path with `throw new ServiceError("<plain message>", 500)`. Inside handlers the wrapper now logs it and returns generic text.
- In the login route (not wrapped) and in the `executePaginatedEntityQuery` / `executeAllEntityQuery` catches, use `console.error` plus `{ error: "Internal Server Error" }` instead.

**Step 11:** Run the checks and the Step 5 grep, then commit: `fix: quote PostgREST search values, safe login redirect, login throttle, generic 5xx, single password helper`

---

### Task 6: Security headers, re-auth on password change, dependency hygiene (L1, L2, L3)

**Skill:** `security-best-practices`

**Files:** `next.config.ts`, `app/api/users/me/route.ts`, `components/account-dialog.tsx`, `package.json`

**Step 1: L1** (`next.config.ts`):

```ts
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
```

`ponytail:` frame-ancestors only. A full script CSP needs nonces for Next inline scripts, so add it when there's a reason.

**Step 2: L2.** In `app/api/users/me/route.ts`, add `current_password: z.string().optional()` to `updateMeSchema`. Add the imports `import { supabase } from "@/lib/supabase";`, `import { verifyPassword } from "@/lib/password";`, and `ServiceError` alongside `handleApiRoute` from `@/lib/api-handler`. Don't import `argon2` (D5). Before `updateUserAccount`:

```ts
if (password && password.trim()) {
  const { data: row } = await supabase
    .from("users")
    .select("password_hash")
    .eq("id", context.user.id)
    .single();
  const ok =
    row && validation.data.current_password
      ? await verifyPassword(validation.data.current_password, row.password_hash)
      : false;
  if (!ok) throw new ServiceError("Current password is incorrect.", StatusCodes.BAD_REQUEST);
}
```

In `components/account-dialog.tsx`, add a `PasswordInput` named `current_password` that renders only while the new-password field is non-empty. Wire it into the existing form schema and payload. Reuse `components/ui/password-input.tsx` and `form-primitives.tsx`; add no new primitives.

**Step 3: L3.** Run `pnpm remove shadcn && pnpm add -D shadcn`, then `pnpm audit --prod`. Expected: 0 vulnerabilities.

**Step 4: Verify.** `curl -sI localhost:3000/login | grep -iE "x-frame|frame-ancestors|nosniff"` should show all three headers. Changing the password in the account dialog without the current password should give a 400.

**Step 5:** Run the checks, then commit: `fix: add security headers, require current password, move shadcn to devDeps`

---

### Task 7: Port PR #9 theme (neumorphic surfaces, clay actions, glass overlays)

**Skill:** `shadcn`. Read `docs/shadcn` first, and keep base-ui component anatomy intact.

**Reference:** `gh pr diff 9 -- app/globals.css components/ui/button.tsx components/ui/card.tsx components/ui/input.tsx components/ui/select.tsx`. Migration's class strings have diverged from master's, so apply the **intent** of each hunk. Don't patch.

**Files:** `app/globals.css`, `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/select.tsx`

**Skipped:** PR #9's sidebar changes. Migration already has `collapsible="icon"` and `<SidebarRail />` (`components/layout/app-sidebar.tsx:48,94`). The dashboard card change is skipped too, because migration has no `components/dashboard`.

**Step 1: `globals.css`.**

- Make `--popover` translucent in both themes: light `color-mix(in oklch, #fcfbf8 60%, transparent)`, dark `color-mix(in oklch, #1d211a 60%, transparent)`.
- Add the glass rule inside `@layer base`, using the same six `data-slot` selectors as PR #9 (all six exist in `components/ui`).
- Append the `--neu-shade` / `--neu-light` tokens (`:root` and `.dark`) and the `@utility neu`, `neu-sm`, `neu-inset` and `clay` blocks verbatim from PR #9.

**Step 2: Components.**

- `button`: `default` adds `clay rounded-xl active:neu-inset`. `outline` becomes `bg-background neu-sm active:neu-inset aria-expanded:neu-inset`, dropping border/bg-muted hovers. `secondary` adds `neu-sm active:neu-inset aria-expanded:neu-inset`. `destructive` adds `clay rounded-xl active:neu-inset`.
- `card`: replace `border border-border/80 bg-card` with `bg-background neu`.
- `input`: replace `border-input bg-transparent` with `border-transparent bg-background neu-inset`, and drop `dark:bg-input/30`.
- `select` trigger: replace `border-input bg-transparent` with `border-transparent bg-background neu-sm`, and drop `dark:bg-input/30 dark:hover:bg-input/50`.

**Step 3: Visual check** with `pnpm dev`, in the built-in browser. Check `/weighments/automatic`, `/users` and `/settings` in light, dark, and at 375px wide:

- buttons look raised and press in;
- inputs look sunken;
- dialogs, selects and dropdowns blur what's behind them;
- focus rings are still visible.

**Step 4:** Run the checks, then commit: `style: port neumorphic, clay and glass theme from master (PR #9)`

---

### Task 8: Notifications schema re-pointed at automatic/manual tables

**Skill:** `supabase-postgres-best-practices`

**Context:** PR #9's `realtime.sql` triggers on `entries`/`weighments`. If it's ported unchanged, the bell goes silent with no error. Migration has four tables, no `customers`, no `unit`, and `net` as a generated column.

**Files:**

- Create: `realtime.sql`. Run it after `schema.sql`, and re-run it after every `schema.sql` run.
- Modify: `README.md`. Add one line describing the run order.

**Step 1: Write `realtime.sql`:**

```sql
-- realtime.sql: run after schema.sql (and re-run after it). Safe to re-run.

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('entry', 'weighment')),
  source TEXT NOT NULL CHECK (source IN ('automatic', 'manual')),
  ref_id INT NOT NULL,
  factory_id INT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  weight NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, source, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_factory_created ON notifications (factory_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY; -- no policies: server only
REVOKE ALL ON notifications FROM anon, authenticated;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION push_notification(n notifications) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM realtime.send(to_jsonb(n) - 'id' - 'factory_id', 'notification', 'factory:' || n.factory_id, true);
END $$;

-- TG_ARGV[0] = 'automatic' | 'manual'
CREATE OR REPLACE FUNCTION entry_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n notifications;
BEGIN
  INSERT INTO notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
  SELECT 'entry', TG_ARGV[0], NEW.id, c.factory_id, NEW.vehicle_number, NEW.weight, NEW.created_at
  FROM centers c WHERE c.id = NEW.center_id
  ON CONFLICT (kind, source, ref_id) DO NOTHING
  RETURNING * INTO n;
  IF n.id IS NOT NULL THEN PERFORM push_notification(n); END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION weighment_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n notifications; v_plate text; v_factory int;
BEGIN
  EXECUTE format(
    'SELECT e.vehicle_number, c.factory_id FROM %I e JOIN centers c ON c.id = e.center_id WHERE e.id = $1',
    TG_ARGV[0] || '_entries')
  INTO v_plate, v_factory USING NEW.in_entry_id;
  INSERT INTO notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
  VALUES ('weighment', TG_ARGV[0], NEW.id, v_factory, v_plate, NEW.net, NEW.created_at)
  ON CONFLICT (kind, source, ref_id) DO NOTHING
  RETURNING * INTO n;
  IF n.id IS NOT NULL THEN PERFORM push_notification(n); END IF;
  RETURN NULL;
END $$;

-- Soft or hard delete removes the row; deleting an entry also removes weighments built on it.
CREATE OR REPLACE FUNCTION notifications_cleanup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME LIKE '%\_entries' THEN
    DELETE FROM notifications WHERE source = TG_ARGV[0] AND kind = 'entry' AND ref_id = OLD.id;
    EXECUTE format(
      'DELETE FROM notifications WHERE source = $1 AND kind = ''weighment''
         AND ref_id IN (SELECT id FROM %I WHERE in_entry_id = $2 OR out_entry_id = $2)',
      TG_ARGV[0] || '_weighments')
    USING TG_ARGV[0], OLD.id;
  ELSE
    DELETE FROM notifications WHERE source = TG_ARGV[0] AND kind = 'weighment' AND ref_id = OLD.id;
  END IF;
  RETURN NULL;
END $$;

-- Plate corrections (correct_automatic_weighment_plate) and weight edits keep the snapshot in step.
-- ponytail: re-scopes the list only; a push already delivered isn't recalled.
CREATE OR REPLACE FUNCTION notifications_sync_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE notifications SET vehicle_number = NEW.vehicle_number, weight = NEW.weight
  WHERE source = TG_ARGV[0] AND kind = 'entry' AND ref_id = NEW.id;
  EXECUTE format(
    'UPDATE notifications SET vehicle_number = $1
     WHERE source = $2 AND kind = ''weighment'' AND ref_id IN (SELECT id FROM %I WHERE in_entry_id = $3)',
    TG_ARGV[0] || '_weighments')
  USING NEW.vehicle_number, TG_ARGV[0], NEW.id;
  RETURN NULL;
END $$;

DO $$
DECLARE s text; e text; w text;
BEGIN
  FOREACH s IN ARRAY ARRAY['automatic', 'manual'] LOOP
    e := s || '_entries'; w := s || '_weighments';
    EXECUTE format('DROP TRIGGER IF EXISTS trg_notify ON %I', e);
    EXECUTE format('CREATE TRIGGER trg_notify AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION entry_notify(%L)', e, s);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_notify ON %I', w);
    EXECUTE format('CREATE TRIGGER trg_notify AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION weighment_notify(%L)', w, s);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_sync ON %I', e);
    EXECUTE format('CREATE TRIGGER trg_notify_sync AFTER UPDATE OF vehicle_number, weight ON %I FOR EACH ROW
      WHEN (OLD.vehicle_number IS DISTINCT FROM NEW.vehicle_number OR OLD.weight IS DISTINCT FROM NEW.weight)
      EXECUTE FUNCTION notifications_sync_entry(%L)', e, s);
    FOREACH e IN ARRAY ARRAY[s || '_entries', s || '_weighments'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_soft_delete ON %I', e);
      EXECUTE format('CREATE TRIGGER trg_notify_soft_delete AFTER UPDATE OF deleted_at ON %I FOR EACH ROW
        WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
        EXECUTE FUNCTION notifications_cleanup(%L)', e, s);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_hard_delete ON %I', e);
      EXECUTE format('CREATE TRIGGER trg_notify_hard_delete AFTER DELETE ON %I FOR EACH ROW
        EXECUTE FUNCTION notifications_cleanup(%L)', e, s);
    END LOOP;
  END LOOP;
END $$;

-- A browser may only listen on its own factory topic (D2: no base role).
DROP POLICY IF EXISTS "notifications_listen" ON realtime.messages;
CREATE POLICY "notifications_listen" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND realtime.topic() = 'factory:' || (auth.jwt() ->> 'factory_id')
  AND (auth.jwt() ->> 'app_role') IN ('admin', 'manager', 'operator')
);

-- New functions are server-only (same rule as schema.sql §8).
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- Backfill the last 24h so the bell isn't empty after deploy (no push).
INSERT INTO notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
SELECT 'entry', 'automatic', e.id, c.factory_id, e.vehicle_number, e.weight, e.created_at
FROM automatic_entries e JOIN centers c ON c.id = e.center_id
WHERE e.deleted_at IS NULL AND e.created_at >= now() - interval '24 hours'
UNION ALL
SELECT 'entry', 'manual', e.id, c.factory_id, e.vehicle_number, e.weight, e.created_at
FROM manual_entries e JOIN centers c ON c.id = e.center_id
WHERE e.deleted_at IS NULL AND e.created_at >= now() - interval '24 hours'
ON CONFLICT (kind, source, ref_id) DO NOTHING;

INSERT INTO notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
SELECT 'weighment', 'automatic', w.id, w.factory_id, w.vehicle_number, w.net, w.created_at
FROM automatic_weighments_view w WHERE w.created_at >= now() - interval '24 hours'
UNION ALL
SELECT 'weighment', 'manual', w.id, w.factory_id, w.vehicle_number, w.net, w.created_at
FROM manual_weighments_view w WHERE w.created_at >= now() - interval '24 hours'
ON CONFLICT (kind, source, ref_id) DO NOTHING;

-- ponytail: no retention job; add a pg_cron prune (>30 days) when the table grows.
NOTIFY pgrst, 'reload schema';
```

Before committing, confirm that the weighment views expose `factory_id`, `vehicle_number` and `net` (`schema.sql:249-318`). Adjust the backfill column names to match.

**Step 2: Verify** on local or staging:

- Run `schema.sql`, then `realtime.sql`, then `pnpm test-seed`.
- `SELECT kind, source, count(*) FROM notifications GROUP BY 1,2;` should show all four combinations.
- Soft-delete one automatic weighment through the app. Its row should be gone.
- Correct a plate. The entry row and the weighment row should both show the new plate.

**Step 3:** Commit: `feat: notifications table and realtime triggers for automatic/manual tables`

---

### Task 9: Notifications API and realtime token

**Skill:** `nextjs-best-practices`

**Files:**

- Create: `lib/realtime-token.ts`, `app/api/notifications/route.ts`, `app/api/notifications/seen/route.ts`, `app/api/realtime/token/route.ts`
- Modify: `scripts/test-security.ts`, `README.md` (env names, D6). **Do not create `.env.example`:** Void's env loader rejects one when `env.ts` is used, so documenting the names in the README keeps a later Void move clean.

**Step 1: Write the failing test** (append):

```ts
import { createHmac } from "node:crypto";
import { signHs256 } from "../lib/realtime-token.ts";

const jwt = signHs256({ sub: "1", exp: 9 }, "s3cret");
const [h, p, sig] = jwt.split(".");
assert.equal(sig, createHmac("sha256", "s3cret").update(`${h}.${p}`).digest("base64url"));
assert.deepEqual(JSON.parse(Buffer.from(p, "base64url").toString()), { sub: "1", exp: 9 });
```

**Step 2:** Create `lib/realtime-token.ts` by copying it from master (`git show origin/master:lib/auth/realtime-token.ts`). It's 13 lines and needs no edits. Run `pnpm test`; it passes.

**Step 3: Create `app/api/realtime/token/route.ts`:**

```ts
import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { handleApiRoute, ServiceError } from "@/lib/api-handler";
import { NOTIFY_ROLES } from "@/lib/security";
import { signHs256 } from "@/lib/realtime-token";

// Short on purpose: Realtime keeps a joined token until it expires, even after logout or a role change.
const TTL_SECONDS = 600;

export const GET = handleApiRoute(
  async (_request, { user, factory }) => {
    const secret = process.env.SUPABASE_JWT_SECRET;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY; // never SUPABASE_SECRET_KEY
    const url = process.env.SUPABASE_URL;
    if (!secret || !anonKey || !url) {
      console.error(
        "Realtime token: SUPABASE_JWT_SECRET, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL required",
      );
      throw new ServiceError("Realtime unavailable", StatusCodes.INTERNAL_SERVER_ERROR);
    }
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + TTL_SECONDS;
    const token = signHs256(
      {
        aud: "authenticated",
        role: "authenticated",
        sub: String(user.id),
        app_role: user.role,
        factory_id: factory.id,
        iat,
        exp,
      },
      secret,
    );
    return NextResponse.json(
      { token, url, anonKey, topic: `factory:${factory.id}`, expiresAt: exp * 1000 },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { roles: NOTIFY_ROLES },
);
```

**Step 4: Create `app/api/notifications/route.ts`** (last 24h, newest 20):

```ts
import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { subHours } from "date-fns";
import { handleApiRoute, ServiceError } from "@/lib/api-handler";
import { NOTIFY_ROLES } from "@/lib/security";
import { supabase } from "@/lib/supabase";

const WINDOW_HOURS = 24;
const LIMIT = 20;

export const GET = handleApiRoute(
  async (_request, { user, factory }) => {
    const [list, me] = await Promise.all([
      supabase
        .from("notifications")
        .select("kind, source, ref_id, vehicle_number, weight, created_at")
        .eq("factory_id", factory.id)
        .gte("created_at", subHours(new Date(), WINDOW_HOURS).toISOString())
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase.from("users").select("notifications_seen_at").eq("id", user.id).maybeSingle(),
    ]);
    if (list.error || me.error) {
      throw new ServiceError("Failed to load notifications", StatusCodes.INTERNAL_SERVER_ERROR);
    }
    const data = (list.data ?? []).map((n) => ({ ...n, weight: Number(n.weight) }));
    return NextResponse.json({ data, seenAt: me.data?.notifications_seen_at ?? null });
  },
  { roles: NOTIFY_ROLES },
);
```

**Step 5: Create `app/api/notifications/seen/route.ts`.** It's a `POST` that sets `users.notifications_seen_at = now`, filtered by `.eq("id", user.id)` and `{ roles: NOTIFY_ROLES }`, and returns `{ seenAt }`. Mirror master's file, but use `handleApiRoute` and `ServiceError`.

**Step 6: Document env names in `README.md`.** Add this section directly after the DB run-order line that Task 8 added. Names only, never values:

```markdown
## Environment

Set these in `.env.local` (dev) and in Vercel (prod). There's deliberately no `.env.example`.

| Name                       | Used by                         | Notes                                                          |
| -------------------------- | ------------------------------- | -------------------------------------------------------------- |
| `SUPABASE_URL`             | server, realtime token          | Project URL                                                    |
| `SUPABASE_SECRET_KEY`      | server only (`lib/supabase.ts`) | Secret / service-role key. Never sent to the browser           |
| `SUPABASE_PUBLISHABLE_KEY` | `/api/realtime/token` → browser | Anon key; safe to expose, gets no grants after `schema.sql` §8 |
| `SUPABASE_JWT_SECRET`      | `/api/realtime/token`           | Signs 10-minute Realtime JWTs                                  |
```

Check: `test ! -e .env.example && grep -c "SUPABASE_JWT_SECRET" README.md`. Expected: `1`.

**Step 7: Verify.**

- As an operator, `curl` with the session cookie: `GET /api/notifications` returns 200 and `GET /api/realtime/token` returns 200 with `topic: "factory:<id>"`.
- As base, both return 403.
- The token response has a `no-store` header and never contains the secret key.

**Step 8:** Run the checks, then commit: `feat: notifications, mark-seen and scoped realtime token endpoints; document env names`

---

### Task 10: Notification bell in the header

**Skill:** `react-useeffect`. The subscription, token refresh and reconnect effect is where this component can fail.

**Files:**

- Create: `vitest.config.ts`, `vitest.setup.ts` (verbatim from `origin/master`), `components/notification-bell.test.tsx` (adapted from `origin/master:components/notification-bell.test.tsx`), and `components/notification-bell.tsx`, by copying `git show origin/master:components/notification-bell.tsx`, then applying the edits in Step 4.
- Modify: `package.json` (dev deps + `test` / `test:ui` scripts, D7), `components/layout/app-header-controls.tsx` (mount it), and `lib/icons.ts` if it lacks a bell icon.

**Step 1: Add Vitest (D7).** Use the same packages and major versions as `origin/master` / `../janus/package.json`:

```bash
pnpm add -D vitest@^5.0.1 happy-dom@^20.14.5 @testing-library/react@^16.3.3 @testing-library/jest-dom@^7.0.1
git show origin/master:vitest.config.ts > vitest.config.ts
git show origin/master:vitest.setup.ts > vitest.setup.ts
```

`vitest.config.ts` is `environment: "happy-dom"`, `globals: true`, `setupFiles: "./vitest.setup.ts"`, plus the `@` → repo-root alias. `vitest.setup.ts` is the single line `import "@testing-library/jest-dom/vitest";`. Vitest's default include (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) doesn't match `scripts/test-*.ts`, so the node suites stay on node.

In `package.json` scripts:

```json
"test": "node --experimental-strip-types scripts/test-validation.ts && node --experimental-strip-types scripts/test-security.ts && vitest run",
"test:ui": "vitest run",
```

Run: `pnpm test:ui`. Expected: `No test files found` (exit 1). That's the RED baseline.

**Step 2: Write the failing bell test**, `components/notification-bell.test.tsx`. It's master's test with these changes:

- `useUserStore` replaces `useAuthStore`.
- Literal URLs replace `ApiRoutes`, and there's no `Unit`.
- A `source` field is added, plus a test that `automatic` and `manual` items with the same `ref_id` are kept apart.
- The links use migration's routes.
- `NOTIFY_ROLES` gating covers admin, manager and base.

```tsx
import { StrictMode } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { useUserStore } from "@/stores/use-user-store";
import type { UserRole } from "@/app/users/types";
import { NotificationBell } from "./notification-bell";

const LIST = "/api/notifications";
const SEEN = "/api/notifications/seen";
const TOKEN = "/api/realtime/token";

const { handlers, channel, fakeClient } = vi.hoisted(() => {
  const handlers: {
    onBroadcast?: (m: { payload: unknown }) => void;
    onStatus?: (s: string) => void;
  } = {};
  const channel = {
    on: vi.fn((_t: unknown, _f: unknown, cb: typeof handlers.onBroadcast) => {
      handlers.onBroadcast = cb;
      return channel;
    }),
    subscribe: vi.fn((cb: typeof handlers.onStatus) => {
      handlers.onStatus = cb;
      return channel;
    }),
  };
  const fakeClient = {
    realtime: { setAuth: vi.fn() },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
  return { handlers, channel, fakeClient };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => fakeClient) }));
vi.mock("axios");

const entry = {
  kind: "entry",
  source: "automatic",
  ref_id: 1,
  vehicle_number: "UP32AB1234",
  weight: 15000,
  created_at: new Date().toISOString(),
};

let list: unknown[] = [];

const loginAs = (role: UserRole) =>
  useUserStore.setState({
    isInitialized: true,
    user: {
      id: 1,
      username: "op",
      name: "Op",
      role,
      factory_id: 1,
      created_at: "",
      updated_at: "",
    },
  });

const listCalls = () => vi.mocked(axios.get).mock.calls.filter(([url]) => url === LIST).length;
const tokenCalls = () => vi.mocked(axios.get).mock.calls.filter(([url]) => url === TOKEN).length;

/** Renders the bell and waits until the channel has subscribed. */
async function renderSubscribed() {
  const view = render(<NotificationBell />);
  await waitFor(() => expect(channel.subscribe).toHaveBeenCalled());
  await act(async () => handlers.onStatus?.("SUBSCRIBED"));
  return view;
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete handlers.onBroadcast;
    delete handlers.onStatus;
    list = [entry];
    vi.mocked(axios.get).mockImplementation(async (url: string) =>
      url === TOKEN
        ? {
            data: {
              token: "t",
              url: "u",
              anonKey: "k",
              topic: "factory:1",
              expiresAt: Date.now() + 3600e3,
            },
          }
        : { data: { data: list, seenAt: null } },
    );
    vi.mocked(axios.post).mockImplementation(async () => ({
      data: { seenAt: new Date(Date.now() + 1000).toISOString() },
    }));
    loginAs("operator");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to the private topic from the token, authorising before subscribe", async () => {
    await renderSubscribed();

    expect(createClient).toHaveBeenCalledWith(
      "u",
      "k",
      expect.objectContaining({ accessToken: expect.any(Function) }),
    );
    const [, , opts] = vi.mocked(createClient).mock.calls[0];
    await expect(opts?.accessToken?.()).resolves.toBe("t");
    expect(fakeClient.channel).toHaveBeenCalledWith("factory:1", { config: { private: true } });
    expect(fakeClient.realtime.setAuth).toHaveBeenCalledWith("t");
    expect(fakeClient.realtime.setAuth.mock.invocationCallOrder[0]).toBeLessThan(
      channel.subscribe.mock.invocationCallOrder[0],
    );
  });

  it("shows a pushed notification as unread without polling", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    list = [];
    await renderSubscribed();

    act(() =>
      handlers.onBroadcast?.({
        payload: { ...entry, ref_id: 2, weight: "1500", created_at: new Date().toISOString() },
      }),
    );
    expect(await screen.findByRole("button", { name: /1 unread/i })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(listCalls()).toBe(2); // mount + SUBSCRIBED, nothing on a timer

    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/1,500 kg/i)).toBeInTheDocument(); // string weight coerced
  });

  it("marks seen on the server when opened and clears the count", async () => {
    await renderSubscribed();
    const bell = await screen.findByRole("button", { name: /1 unread/i });

    fireEvent.click(bell);
    expect(await screen.findByText("UP32AB1234")).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(SEEN);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /notifications/i })).not.toHaveAccessibleName(
        /unread/i,
      ),
    );
  });

  it("ignores a duplicate push of the same kind, source and ref_id", async () => {
    await renderSubscribed();
    await screen.findByRole("button", { name: /1 unread/i });

    act(() => handlers.onBroadcast?.({ payload: { ...entry } }));

    expect(screen.getByRole("button", { name: /1 unread/i })).toBeInTheDocument();
  });

  it("keeps an automatic and a manual item that share a ref_id", async () => {
    await renderSubscribed();
    await screen.findByRole("button", { name: /1 unread/i });

    act(() => handlers.onBroadcast?.({ payload: { ...entry, source: "manual" } }));

    expect(await screen.findByRole("button", { name: /2 unread/i })).toBeInTheDocument();
  });

  it("removes the channel and stops the token refresh on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { unmount } = await renderSubscribed();

    unmount();

    expect(fakeClient.removeChannel).toHaveBeenCalledWith(channel);
    await vi.advanceTimersByTimeAsync(3600e3);
    expect(tokenCalls()).toBe(1);
  });

  it("does not retry the token on a 4xx", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url === TOKEN) throw { response: { status: 403 } };
      return { data: { data: list, seenAt: null } };
    });
    render(<NotificationBell />);
    await waitFor(() => expect(tokenCalls()).toBe(1));

    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(tokenCalls()).toBe(1);
  });

  it("fetches a fresh token when the channel join is refused", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderSubscribed();

    await act(async () => handlers.onStatus?.("CHANNEL_ERROR"));
    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(tokenCalls()).toBe(2);
    expect(fakeClient.realtime.setAuth).toHaveBeenCalledTimes(2);
    expect(createClient).toHaveBeenCalledTimes(1); // same client, new token
  });

  it("creates a single client and channel under StrictMode double-invoke", async () => {
    render(
      <StrictMode>
        <NotificationBell />
      </StrictMode>,
    );
    await waitFor(() => expect(channel.subscribe).toHaveBeenCalled());

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(fakeClient.channel).toHaveBeenCalledTimes(1);
  });

  it("links each item to its source table filtered by id", async () => {
    await renderSubscribed();
    fireEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    const link = await screen.findByRole("link", { name: /UP32AB1234/ });
    expect(link).toHaveAttribute("href", "/entries/automatic?id=1");
  });

  it.each(["admin", "manager"] as const)("renders for %s (NOTIFY_ROLES)", async (role) => {
    loginAs(role);
    await renderSubscribed();
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });

  it("renders nothing and fetches nothing for base (not in NOTIFY_ROLES)", () => {
    loginAs("base");
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
    expect(axios.get).not.toHaveBeenCalled();
  });
});
```

**Step 3:** Run `pnpm test:ui`. Expected: FAIL, `Failed to resolve import "./notification-bell"`.

**Step 4: Copy master's bell and adapt it:**

- **Icon:** replace `lucide-react`'s `Bell` with the hugeicons bell from `lib/icons.ts` (`Notification03Icon` or similar). Add it there if it's missing.
- **Store:** `useAuthStore` / `hasPageAccess` / `hydrated` become `useUserStore((s) => s.user)` from `@/stores/use-user-store`. Render `null` unless `user && NOTIFY_ROLES.includes(user.role)`.
- **Routes:** drop `ApiRoutes`, `PROJECTS` and `ProjectSlug`, and use literal paths: `/api/notifications`, `/api/notifications/seen`, `/api/realtime/token`.
- **Item links:** use `/${n.kind === "entry" ? "entries" : "weighments"}/${n.source}?id=${n.ref_id}`. Drop the `project` badge `<span>` in `Row`, since `PROJECTS` / `projectBySlug` don't exist here.
- **Dedupe key includes `source`:** master filters on `p.kind === n.kind && p.ref_id === n.ref_id` and keys rows `${n.kind}-${n.ref_id}`. Migration has separate id sequences for automatic and manual tables, so make both `kind + source + ref_id`, i.e. ``key={`${n.kind}-${n.source}-${n.ref_id}`}``. Otherwise manual #1 silently replaces automatic #1.
- **Type:** declare `type Notification = { kind: "entry" | "weighment"; source: "automatic" | "manual"; ref_id: number; vehicle_number: string; weight: number; created_at: string }` inline in the file. It has one consumer, so it doesn't need a types file.
- **Unit:** remove all `unit` handling; weights are shown as `${n.weight.toLocaleString()} kg`.
- Keep master's effect logic unchanged: private channel, `setAuth`, refresh before expiry, refetch on join refusal and on reconnect, and `removeChannel` on cleanup. Behaviour that has been tested is worth more than a rewrite.

**Step 5:** Run `pnpm test`. Expected: both node suites print their `✓` lines, then Vitest reports `notification-bell.test.tsx` with all 13 tests passing (the `it.each` counts as 2). A failure here means the adaptation in Step 4 changed behaviour: fix the component, not the test.

**Step 6: Mount it** in `AppHeaderControls`, as the first child of its right-hand flex group. Don't use master's `fixed top-3 right-4`; migration already has a header grid with a right column (`components/booting-screen.tsx:144-146`).

**Step 7: Verify in the browser** with `pnpm dev`:

- As an operator, the bell shows the backfilled items.
- Insert an `automatic_entries` row in SQL. It appears within about 1s, with no page reload.
- Open the bell. The unread badge clears, then reload; it stays cleared.
- Log in as base. There's no bell.
- In the network tab, there are no repeating `/api/notifications` polls.
- Check dark mode and 375px width.

**Step 8:** Run the checks, then commit: `feat: realtime notification bell in the header with vitest coverage`

`ponytail:` only the bell gets a DOM test. Port master's other `*.test.tsx` files when those components change.

---

### Task 11: Final gate (orchestrator, not a subagent)

**Skill:** `verification-loop`

Run the full loop. Don't claim done until every item passes, and show the output for each one.

1. **Static (AGENTS.md §5):** `pnpm type-check`, `pnpm lint`, `pnpm exec oxfmt --check <all files changed on the branch>` (`git diff --name-only migration...HEAD`). Expected: 0 errors and 0 warnings. Still never `pnpm build` and never bare `pnpm fmt`.
2. **Unit + DOM:** `pnpm test`. Expected: `✓ security helpers`, `✓ supabase client is lazy`, `✓ password boundary`, the validation suite, then Vitest with `notification-bell.test.tsx` passing 13/13. `pnpm test:ui` alone also passes.
   2a. **No module-scope side effects (D5/D6):**
   - `grep -nE "process\.env|createClient" lib/supabase.ts`: every match is inside `getClient()`, none at top level.
   - `grep -n "DUMMY_HASH" lib/password.ts app/api/auth/login/route.ts`: a string literal in `lib/password.ts` and an import in the route; no `argon2.hash(` / `hashPassword(` at module scope.
   - `grep -rn "argon2" app lib scripts components | grep -v lib/password.ts`: no output.
   - `test ! -e .env.example && echo ok`: prints `ok`.
3. **Deps:** `pnpm audit --prod` reports 0.
4. **Secrets:** `git diff migration...HEAD | grep -iE "sb_secret|service_role|eyJhbGci|SUPABASE_.*=.+"`. Expected: no matches.
5. **DB lockdown** (local or staging): repeat Task 1 Step 4's three anon probes. Also call `/rest/v1/notifications` with a realtime token from `/api/realtime/token`; it should be denied.
6. **Role matrix** (seeded users from `scripts/test-seed/users.ts`): for admin, manager, operator and base, `curl` every non-GET route in D1. Expected codes:
   - 403 where D1 denies the role;
   - 2xx or 4xx-validation where D1 allows it;
   - 401 with no cookie, and 401 with forged `x-user-*` headers and no cookie.
7. **Session:** expiry and revocation as in Task 3 Step 4. Logout, then reuse the old cookie: 401.
8. **Injection, redirect and login:**
   - The search probe from Task 5 Step 6 returns `[]`.
   - `/login?next=//evil.com` stays on the origin.
   - Six bad logins in a row: the sixth gets a 429.
   - A missing user and a wrong password give the same message.
   - Forcing a DB error returns a generic 500 body.
9. **Headers:** `curl -sI` shows the L1 headers.
10. **UI and realtime:** repeat the Task 7 Step 3 and Task 10 Step 7 browser checks once more on the final branch.
11. **Diff review:** run the `code-reviewer` agent over `git diff migration...HEAD`. Fix any CRITICAL or HIGH issue, then re-run the loop from step 1.

Then open the PR into `migration`. The body lists:

- **Decisions D1–D7**, with a link to the "Architectural Alignment & Shift Rationale" section.
- **Deploy order:** env keys as listed in `README.md` → `schema.sql` → `realtime.sql` → redeploy → test a Hermes or manual entry and check the bell.
- **Tests:** the `pnpm test` output (node suites + Vitest bell suite) and the step 2a greps.
- **Left out on purpose:** signed photo URLs, a nonce CSP, a shared rate-limit store, a notification retention job, DOM tests for other components, and the vinext/Void migration.

---

## Hermes Ingest & Future Cloudflare/Void Readiness (checklist, no code in this plan)

When device ingest (`POST /api/entries`, re-adding what Task 4 deleted as `isPublicAutomaticIngest`) is ported for Hermes:

- [ ] **No `sharp`.** Cropping and compression stay on the Pi in `../hermes/src/services/image_compressor.py` (opencv-python). Janus stores what Hermes uploads.
- [ ] Ingest authenticates with the center `api_key` (Basic/API-key), never a session cookie, and goes through `handleApiRoute` or an equivalent single guard.
- [ ] Passwords and keys are hashed only through `lib/password.ts` (D5).
- [ ] No new module-scope env reads or client construction (D6); new env names go in the README table, not `.env.example`.

Before any `vinext` / Void evaluation:

- [ ] Swap `lib/password.ts` to a WASM Argon2id package and confirm a hash made by current `argon2` still verifies.
- [ ] Add `images: { unoptimized: true }` to `next.config.ts` (`next/image` is used in `components/booting-screen.tsx`), keeping Task 6's `headers()`.
- [ ] `proxy.ts` runs on every non-asset path, so on Cloudflare Workers it needs `run_worker_first: ['/*']`. Budget a Worker invocation per request, including the `getSessionUser` lookup.
- [ ] Re-check the vinext adapter's stability and Void's env-file rules against current Void docs. They weren't available locally when this plan was written.
