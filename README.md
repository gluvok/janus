# GluVok / Mesto Weighbridge Platform

A centralized operational platform and automation management system for weighbridge facilities, featuring dual-mode (Automatic and Manual) weighments tracking, multi-scale support, role-based access control, persistent session authentication, and hardware integration.

---

## Architecture Overview

### Core Entities

- **Factories**: Master enterprise tenants managing scales, settings, and receipt formatting.
- **Centers**: Processing facilities and scale locations. Each center has an authenticated `api_key` for hardware scale and camera integration (hidden during `GET` requests).
- **Users**: System operators, managers, and administrators with argon2 password hashing.
- **Sessions**: Database-backed user authentication sessions with 400-day persistent rolling HTTP-only cookies (`mesto_session`).
- **Automatic Weighments**: Hardware/ANPR camera-captured vehicle weighments. Features PostgreSQL stored generated columns (`gross`, `tare`, `net`, `type`), inbound/outbound weights, timestamps, and camera image URLs.
- **Manual Weighments**: Operator-recorded weighments with full creator accountability (`in_creator_id`, `out_creator_id`).
- **Tickets**: Support and discrepancy tickets linked directly to `automatic_weighments` via `automatic_weighment_id`.

### Stored Generated Columns (`automatic_weighments` & `manual_weighments`)

- `gross`: `CASE WHEN out_weight IS NULL THEN in_weight ELSE GREATEST(in_weight, out_weight) END`
- `tare`: `CASE WHEN out_weight IS NULL THEN NULL ELSE LEAST(in_weight, out_weight) END`
- `net`: `CASE WHEN out_weight IS NULL THEN NULL ELSE ABS(in_weight - out_weight) END`
- `type`:
  ```sql
  CASE
      WHEN out_weight IS NULL THEN 'pending'::weighment_type
      WHEN in_weight > out_weight THEN 'in'::weighment_type
      WHEN in_weight < out_weight THEN 'out'::weighment_type
      ELSE 'unassigned'::weighment_type
  END
  ```

---

## Authentication & Session Management

- **Session Architecture**: Next.js route protection via `proxy.ts` verifying the `mesto_session` cookie against PostgreSQL `sessions` table. Injects validated user headers (`x-user-id`, `x-factory-id`, `x-user-role`, `x-user-name`, `x-user-username`) into downstream requests with zero DB fallback queries.
- **Session Duration**: 400-day persistent server-set HTTP-only cookie with rolling refresh upon active use (bypassing client-side Safari ITP limits).
- **Credentials**: Standard username and password (argon2 hashed). No external emails or sign-up workflows.
- **Dynamic Factory Tenancy**: All operations, center filtering, and user creation are dynamically scoped to the authenticated user's `factory_id`.
- **Client State**: RootLayout initializes `useUserStore` directly from the validated session. `AppSidebar` and `AccountDialog` read and update this store reactively without redundant `GET /api/users/me` requests.
- **Mode Persistence**: Automatic/Manual weighment mode is persisted per-table inside the `mesto_tables_state` cookie (`tables.weighments.mode`) without global state pollution.

---

## API Routes

| Method   | Endpoint                    | Description                                                                               |
| :------- | :-------------------------- | :---------------------------------------------------------------------------------------- |
| `POST`   | `/api/auth/login`           | Authenticate via username & password, issue rolling session cookie.                       |
| `POST`   | `/api/auth/logout`          | Invalidate session in database and delete session cookie.                                 |
| `PATCH`  | `/api/users/me`             | Update profile details and password for current user.                                     |
| `GET`    | `/api/factories`            | Retrieve factory configuration for the authenticated user's factory.                      |
| `PATCH`  | `/api/factories`            | Update factory configuration for the authenticated user's factory.                        |
| `GET`    | `/api/centers`              | List centers for authenticated factory. Supports pagination & sorting.                    |
| `PATCH`  | `/api/centers`              | Update center details.                                                                    |
| `GET`    | `/api/weighments/automatic` | List automatic weighments with stored generated fields (`gross`, `tare`, `net`, `type`).  |
| `POST`   | `/api/weighments/automatic` | Ingest vehicle weighing. Auto-matches open pending weighments or creates inbound records. |
| `PATCH`  | `/api/weighments/automatic` | Manually correct automatic weighment plates, weights, or centers.                         |
| `GET`    | `/api/weighments/manual`    | List manual weighments with creator relations.                                            |
| `GET`    | `/api/users`                | List staff users (Admin, Manager, Operator, Base) for current factory.                    |
| `POST`   | `/api/users`                | Create staff user accounts linked to current factory.                                     |
| `PATCH`  | `/api/users`                | Update staff user accounts.                                                               |
| `DELETE` | `/api/users`                | Hard-delete users (protected by `ON DELETE RESTRICT` against linked weighments/tickets).  |

---

## Development & Verification

```bash
# Type check
pnpm type-check

# Lint & Format
pnpm lint
pnpm fmt

# Production build
pnpm run build

# Seed database
pnpm run seed
pnpm run seed:test
```
