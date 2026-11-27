# GluVok / Mesto Weighbridge Platform

A centralized operational platform and automation management system for weighbridge facilities, featuring dual-mode (Automatic and Manual) weighments tracking, multi-scale support, role-based access control, persistent session authentication, and hardware integration.

---

## Architecture Overview

### Core Entities

- **Factories**: Master enterprise tenants managing scales, settings, and receipt formatting.
- **Centers**: Processing facilities and scale locations. Each center has an API key for hardware scale and camera integration, stored only as a SHA-256 hash (`api_key_hash`).
- **Users**: System operators, managers, and administrators with argon2 password hashing.
- **Sessions**: Database-backed user authentication sessions with 400-day persistent rolling HTTP-only cookies (`mesto_session`).
- **Automatic Weighments**: Hardware/ANPR camera-captured vehicle weighments. Features PostgreSQL stored generated columns (`gross`, `tare`, `net`, `type`), inbound/outbound weights, timestamps, and separate inbound/outbound photo arrays (`in_images`, `out_images`) unified via stored generated column `images = in_images || out_images`.
- **Manual Weighments**: Operator-recorded weighments with full creator accountability (`creator_id`), inbound/outbound weights, and photo arrays (`in_images`, `out_images`).
- **Support & Services**: Common reusable `UnderConstruction` placeholder pages at `/support` and `/services`.

### Stored Generated Columns (`automatic_weighments` & `manual_weighments`)

- `images`: `in_images || out_images` (PostgreSQL stored concatenation of inbound and outbound camera photos)
- `gross`: `CASE WHEN out_weight IS NULL THEN in_weight ELSE GREATEST(in_weight, out_weight) END` (always valid and non-null)
- `tare`: `CASE WHEN out_weight IS NULL THEN NULL ELSE LEAST(in_weight, out_weight) END` (null only in pending automatic weighments; always non-null in manual weighments)
- `net`: `CASE WHEN out_weight IS NULL THEN NULL ELSE ABS(in_weight - out_weight) END` (null only in pending automatic weighments; always non-null in manual weighments)
- `type`:
  - `automatic_weighments.type` (`automatic_weighment_type`):
    ```sql
    CASE
        WHEN out_weight IS NULL THEN 'pending'::automatic_weighment_type
        WHEN in_weight > out_weight THEN 'in'::automatic_weighment_type
        WHEN in_weight < out_weight THEN 'out'::automatic_weighment_type
        ELSE 'unassigned'::automatic_weighment_type
    END
    ```
  - `manual_weighments.type` (`complete_weighment_type`):
    ```sql
    CASE
        WHEN in_weight > out_weight THEN 'in'::complete_weighment_type
        WHEN in_weight < out_weight THEN 'out'::complete_weighment_type
        ELSE 'unassigned'::complete_weighment_type
    END
    ```
- **Mode-Specific Layout**: Automatic weighments omit the Operator column and show In/Out ANPR camera badges. Manual weighments include the Operator column (`creator`). The table defaults to `updated_at DESC`.

### Advanced Multi-Column Search

Search queries across data tables dynamically evaluate type-aware multi-column matching:

- **Centers**: `name` (text ILIKE) and `id` (integer exact match).
- **Weighments**: `vehicle_number` (text ILIKE), `id` (integer exact match), weights: `net`, `gross`, `tare`, `in_weight`, `out_weight` (numeric match), and `in_center`/`out_center` facility names (subquery match).
- **Users**: `name`, `username` (text ILIKE), and `id` (integer match).

---

## Authentication & Session Management

- **Session Architecture**: Next.js route protection via `proxy.ts` verifying the `mesto_session` cookie against an in-memory LRU cache backed by PostgreSQL `sessions` table (joining `users` and `factories`). Injects validated user and factory headers (`x-user-id`, `x-factory-id`, `x-user-role`, `x-user-name`, `x-user-username`, `x-user-created-at`, `x-user-updated-at`, `x-factory-name`, `x-factory-receipt-images`, `x-factory-created-at`, `x-factory-updated-at`) into downstream requests with < 0.1ms latency on warm requests.
- **Auto-Guarded API Routes**: All protected route handlers wrapped with `handleApiRoute` automatically verify session headers and inject authenticated `{ user, factory }` context.
- **Automatic Factory Scoping**: All paginated queries (`executePaginatedEntityQuery` and `buildPaginatedEntityResult`) automatically enforce tenant isolation by `factory_id` across `centers`, `users`, `factories`, and `weighments` beforehand.
- **Session Duration**: Standard 7-day persistent server-set HTTP-only cookie with zero speculative rolling write updates.
- **Credentials**: Standard username and password (argon2 hashed). No external emails or sign-up workflows.
- **Dynamic Factory Tenancy**: All operations, center filtering, and user creation are dynamically scoped to the authenticated user's `factory_id`.
- **Client State**: RootLayout initializes separated `useUserStore` (user identity) and `useFactoryStore` (facility preferences) directly from the validated session. `AppSidebar`, `AccountDialog`, and `SettingsDialog` read and update these stores reactively.
- **Mode Persistence**: Automatic/Manual weighment mode is persisted per-table inside the `mesto_tables_state` cookie (`tables.weighments.mode`) without global state pollution.

---

## API Routes

| Method   | Endpoint                    | Description                                                                                           |
| :------- | :-------------------------- | :---------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/auth/login`           | Authenticate via username & password, issue rolling session cookie.                                   |
| `POST`   | `/api/auth/logout`          | Invalidate session in database and delete session cookie.                                             |
| `GET`    | `/api/users/me`             | Retrieve live profile details and factory configuration for authenticated user.                       |
| `PATCH`  | `/api/users/me`             | Update profile details and password for current user.                                                 |
| `GET`    | `/api/factories`            | Retrieve factory configuration (served directly from memory session cache with 0 DB queries).         |
| `PATCH`  | `/api/factories`            | Update factory configuration for the authenticated user's factory.                                    |
| `GET`    | `/api/centers`              | List centers for authenticated factory (never returns `api_key_hash`). Supports pagination & sorting. |
| `PATCH`  | `/api/centers`              | Update center details.                                                                                |
| `POST`   | `/api/centers/rotate-key`   | Admin only. Issue a new center API key; returns the plain key once, stores only its SHA-256.          |
| `POST`   | `/api/entries`              | Hermes device ingest (multipart). Basic `center_id:api_key`, no session. See below.                   |
| `GET`    | `/api/weighments/automatic` | List automatic weighments with stored generated fields (`gross`, `tare`, `net`, `type`).              |
| `GET`    | `/api/weighments/manual`    | List manual weighments with creator relations.                                                        |
| `GET`    | `/api/users`                | List staff users (Admin, Manager, Operator, Base) for current factory.                                |
| `POST`   | `/api/users`                | Create staff user accounts linked to current factory.                                                 |
| `PATCH`  | `/api/users`                | Update staff user accounts.                                                                           |
| `DELETE` | `/api/users`                | Hard-delete users (protected by `ON DELETE RESTRICT` against linked weighments/entries).              |

### Device ingest (Hermes)

`POST /api/entries` takes Hermes's multipart upload, authenticated with HTTP Basic `center_id:api_key`. In the Hermes license, `device_id` is the center id and `device_key` is the key.

Issue (or rotate) a key from the browser console while logged in as admin. The old key stops working at once and the new one is shown only this time:

```js
await (
  await fetch("/api/centers/rotate-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: 1 }),
  })
).json();
```

SQL fallback (the key then sits in your SQL history):

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

```sql
UPDATE public.centers SET api_key_hash = encode(sha256(convert_to('<key>','UTF8')),'hex'), updated_at = now() WHERE id = <id>;
```

Responses: `201` created (`{"data":{"id":N}}`), `200` duplicate (existing id), `400` invalid form or image storage failed, `401` bad credentials, `403` form `center_id` doesn't match the credentials, `429` rate limited, `500` server error.

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
pnpm fmt

# Run validation & schema invariant test suite
pnpm test

# Production build
pnpm run build

# Seed database
pnpm run seed              # Onboard factory & admin (--factory, --receipt-images-per-row, --centers)
pnpm run test-seed         # High-volume test seeding with unique weighment photos
pnpm run test-seed --clean # Clean reset & seed high-volume test data with unique weighment photos
```
