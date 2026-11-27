# GluVok / Mesto Weighbridge Platform

Weighbridge management app. Scale devices post vehicle readings (automatic entries), manual entries record the user who made them, and a weighment pairs two entries into gross, tare and net weight. Data is scoped per factory, and users have one of four roles: `admin`, `manager`, `operator`, `base`.

---

## Architecture Overview

### Core Entities

- **Factories**: Tenants. Each has a name and a receipt layout setting (`receipt_images_per_row`, 1 or 2).
- **Centers**: Scale locations within a factory. Each has an API key for device ingest, stored only as a SHA-256 hash (`api_key_hash`).
- **Users**: Staff with a role (`admin`, `manager`, `operator` or `base`) and an argon2 password hash.
- **Sessions**: Database-backed login sessions, referenced by the HTTP-only `mesto_session` cookie. Only the token's SHA-256 is stored.
- **Entries**: One scale reading: vehicle number, weight, photos. `automatic_entries` come from devices, hold up to 3 photos, and carry an `idempotency_key`, unique per center. `manual_entries` also record `creator_id`.
- **Weighments**: `automatic_weighments` and `manual_weighments` pair an `in_entry_id` with an `out_entry_id`. For device ingest, `ingest_automatic_entry` pairs a new entry with the latest unpaired entry for the same plate in the factory (never for `NO_PLATE_DETECTED`).
- **Support & Services**: Placeholder pages at `/support` and `/services`.

### Weighment fields (`automatic_weighments` and `manual_weighments`)

- `gross`, `tare` and `type` are set by a `BEFORE INSERT/UPDATE` trigger (`trigger_weighments_auto_populate`), which also rejects pairing entries from different factories. `gross` is the heavier entry weight and `tare` the lighter one.
- `type` (`weighment_type`) is `in` when the in entry is heavier, `out` when the out entry is heavier, and `void` when they are equal.
- `net` is a stored generated column: `gross - tare`.
- The `*_weighments_view` views add `in_images`, `out_images` and `images` (both arrays joined), plus in/out times and centers. The manual view adds in/out creator details.
- **Mode-Specific Layout**: Manual weighments add In/Out creator columns to the table. Weighment lists sort by `created_at`, newest first.

### Advanced Multi-Column Search

Search matches these columns:

- **Centers**: `name` (ILIKE) and `id` (exact).
- **Weighments**: `vehicle_number` and in/out center names (ILIKE), `id` (exact), `gross`, `tare` and `net` (exact), and `type` (substring of `in`, `out`, `void`). Manual weighments also match in/out creator names and usernames (ILIKE) and creator roles.
- **Users**: `name` and `username` (ILIKE), `id` (exact), and `role` (substring of the role name).

---

## Authentication & Session Management

- **Session Architecture**: `proxy.ts` checks the `mesto_session` cookie against an in-memory LRU cache (per instance, 10 s TTL) backed by the PostgreSQL `sessions` table (joining `users` and `factories`). It injects the user and factory into request headers (`x-user-id`, `x-factory-id`, `x-user-role`, `x-user-name`, `x-user-username`, `x-user-created-at`, `x-user-updated-at`, `x-factory-name`, `x-factory-receipt-images`, `x-factory-created-at`, `x-factory-updated-at`), which route handlers read instead of querying.
- **Guarded API Routes**: Protected route handlers are wrapped with `handleApiRoute`, which reads the session headers, passes `{ user, factory, params }` to the handler, and returns 401 without a session or 403 when the role is not allowed.
- **Factory Scoping**: All paginated queries (`executePaginatedEntityQuery` and `buildPaginatedEntityResult`) enforce tenant isolation by `factory_id` across `centers`, `users`, `factories`, and the entry and weighment views.
- **Session Duration**: 12 hours from login. The limit is fixed: nothing renews it, and the cookie `maxAge` matches (`SESSION_TTL_SECONDS` in `lib/auth.ts`). Each login deletes that user's expired sessions.
- **Credentials**: Username and password (argon2 hashed). Admins create accounts with `POST /api/users`; there is no sign-up or email flow.
- **Factory Tenancy**: All operations, center filtering, and user creation are scoped to the authenticated user's `factory_id`.
- **Client State**: RootLayout initializes separated `useUserStore` (user identity) and `useFactoryStore` (facility preferences) directly from the validated session. `AppSidebar`, `AccountDialog`, and `SettingsDialog` read and update these stores reactively.
- **Mode Persistence**: Automatic or Manual mode is saved per page (`entries`, `weighments`) in `localStorage` under `mesto_entity_mode`.

---

## API Routes

| Method   | Endpoint                         | Description                                                                                                                      |
| :------- | :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/auth/login`                | Authenticate via username & password, issue session cookie.                                                                      |
| `POST`   | `/api/auth/logout`               | Invalidate session in database and delete session cookie.                                                                        |
| `GET`    | `/api/users/me`                  | Return the session's user and factory.                                                                                           |
| `PATCH`  | `/api/users/me`                  | Update own name, username or password (a new password needs `current_password`). A username or password change ends the session. |
| `GET`    | `/api/factories`                 | Return the session's factory configuration (no query in the handler).                                                            |
| `PATCH`  | `/api/factories`                 | Update factory configuration for the authenticated user's factory.                                                               |
| `GET`    | `/api/centers`                   | List centers for authenticated factory (never returns `api_key_hash`). Supports pagination & sorting.                            |
| `PATCH`  | `/api/centers`                   | Rename a center.                                                                                                                 |
| `POST`   | `/api/entries/automatic`         | Hermes device ingest (multipart). `x-api-key` + `Idempotency-Key`, no session. See below.                                        |
| `GET`    | `/api/entries/automatic`         | List automatic entries (session required).                                                                                       |
| `GET`    | `/api/entries/manual`            | List manual entries with creator details.                                                                                        |
| `GET`    | `/api/weighments/automatic`      | List automatic weighments (`gross`, `tare`, `net`, `type`, in/out entries and centers).                                          |
| `PATCH`  | `/api/weighments/automatic/[id]` | Correct the vehicle number on a weighment and its two entries.                                                                   |
| `DELETE` | `/api/weighments/automatic/[id]` | Soft-delete a weighment and its two entries.                                                                                     |
| `GET`    | `/api/weighments/manual`         | List manual weighments with creator relations.                                                                                   |
| `GET`    | `/api/users`                     | List staff users (Admin, Manager, Operator, Base) for current factory.                                                           |
| `POST`   | `/api/users`                     | Create staff user accounts linked to current factory.                                                                            |
| `PATCH`  | `/api/users`                     | Update staff user accounts.                                                                                                      |
| `DELETE` | `/api/users`                     | Hard-delete users. Blocked with 409 while `manual_entries.creator_id` rows still reference them (`ON DELETE RESTRICT`).          |
| `GET`    | `/api/notifications`             | Latest 20 notifications for the factory, plus the user's `seenAt`.                                                               |
| `POST`   | `/api/notifications/seen`        | Mark notifications as seen now.                                                                                                  |
| `GET`    | `/api/realtime/token`            | Issue a 10-minute Realtime JWT for the `factory:<id>` topic.                                                                     |

`PATCH /api/centers` needs `admin` or `manager`. `PATCH /api/factories`, `POST`/`PATCH`/`DELETE /api/users` and the weighment `PATCH`/`DELETE` need `admin`. Notifications and `/api/realtime/token` allow `admin`, `manager` and `operator`. Every other session route accepts any role.

### Device ingest (Hermes)

`POST /api/entries/automatic` takes Hermes's multipart upload (no session). Send the center's key in the `x-api-key` header and a unique `Idempotency-Key` header (must be a UUIDv7; uppercase is lowercased). The key identifies the center, so there is no `center_id` field. In the Hermes license, `device_key` is the key.

Form fields: `vehicle_number` (plate, or `NO_PLATE_DETECTED` / `REJECTED_*`), `weight`, and up to 3 `file` parts (JPEG, 4 MB in total: Vercel rejects larger request bodies).

Issue (or rotate) a key in SQL. The old key stops working as soon as the `UPDATE` runs. Generate the key, store only its hash, and give the key to the device operator:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

```sql
UPDATE public.centers SET api_key_hash = encode(sha256(convert_to('<key>','UTF8')),'hex'), updated_at = now() WHERE id = <id>;
```

Responses: `201` created, `200` replay of an existing `Idempotency-Key` (same body shape, existing entry), both `{"data":{"id":N,"weighment_id":N}}`; `400` invalid form, header or images (or image storage failed); `401` missing or unknown key; `429` rate limited (5 requests per minute per key, with a `Retry-After` header in seconds); `500` server error. A replay with a different payload still returns the original entry.

---

## Database setup

Run `schema.sql`, then `realtime.sql` (non-destructive and safe to re-run against both fresh databases and existing legacy schemas).

---

## Environment

Set these in `.env.local` (dev) and in Vercel (prod). There's deliberately no `.env.example`.

| Name                       | Used by                         | Notes                                                          |
| -------------------------- | ------------------------------- | -------------------------------------------------------------- |
| `SUPABASE_URL`             | server, realtime token          | Project URL                                                    |
| `SUPABASE_SECRET_KEY`      | server only (`lib/supabase.ts`) | Secret / service-role key. Never sent to the browser           |
| `SUPABASE_PUBLISHABLE_KEY` | `/api/realtime/token` → browser | Anon key; safe to expose, gets no grants after `schema.sql` §8 |
| `SUPABASE_JWT_SECRET`      | `/api/realtime/token`           | Signs 10-minute Realtime JWTs                                  |

---

## Development & Verification

```bash
# Type check
pnpm type-check

# Lint & Format
pnpm lint
pnpm exec oxfmt <files>

# Validation, security and UI tests
pnpm test

# Production build
pnpm run build

# Seed database
pnpm run seed              # Onboard factory & admin (--factory, --receipt-images-per-row, --centers)
pnpm run test-seed         # High-volume test seeding with unique weighment photos
pnpm run test-seed --clean # Clean reset & seed high-volume test data with unique weighment photos
```
