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

- **Session Architecture**: Next.js route protection via `proxy.ts` verifying the `mesto_session` cookie against PostgreSQL `sessions` table (joining `users` and `factories`). Injects validated user and factory headers (`x-user-id`, `x-factory-id`, `x-user-role`, `x-user-name`, `x-user-username`, `x-user-created-at`, `x-user-updated-at`, `x-factory-name`, `x-factory-receipt-images`, `x-factory-created-at`, `x-factory-updated-at`) into downstream requests with zero DB fallback queries.
- **Auto-Guarded API Routes**: All protected route handlers wrapped with `handleApiRoute` automatically verify session headers and inject authenticated `{ user, factoryId, factory }` context.
- **Automatic Factory Scoping**: All paginated queries (`executePaginatedEntityQuery` and `buildPaginatedEntityResult`) automatically enforce tenant isolation by `factory_id` across `centers`, `users`, `factories`, `weighments`, and `tickets` beforehand.
- **Session Duration**: 400-day persistent server-set HTTP-only cookie with rolling refresh upon active use (bypassing client-side Safari ITP limits).
- **Credentials**: Standard username and password (argon2 hashed). No external emails or sign-up workflows.
- **Dynamic Factory Tenancy**: All operations, center filtering, and user creation are dynamically scoped to the authenticated user's `factory_id`.
- **Client State**: RootLayout initializes `useUserStore` with both user and factory directly from the validated session. `AppSidebar` and `AccountDialog` read and update this store reactively, performing live session checks on Account access.
- **Mode Persistence**: Automatic/Manual weighment mode is persisted per-table inside the `mesto_tables_state` cookie (`tables.weighments.mode`) without global state pollution.

---

## API Routes

| Method   | Endpoint                    | Description                                                                              |
| :------- | :-------------------------- | :--------------------------------------------------------------------------------------- |
| `POST`   | `/api/auth/login`           | Authenticate via username & password, issue rolling session cookie.                      |
| `POST`   | `/api/auth/logout`          | Invalidate session in database and delete session cookie.                                |
| `GET`    | `/api/users/me`             | Retrieve live profile details and factory configuration for authenticated user.          |
| `PATCH`  | `/api/users/me`             | Update profile details and password for current user.                                    |
| `GET`    | `/api/factories`            | Retrieve factory configuration for the authenticated user's factory.                     |
| `PATCH`  | `/api/factories`            | Update factory configuration for the authenticated user's factory.                       |
| `GET`    | `/api/centers`              | List centers for authenticated factory. Supports pagination & sorting.                   |
| `PATCH`  | `/api/centers`              | Update center details.                                                                   |
| `GET`    | `/api/weighments/automatic` | List automatic weighments with stored generated fields (`gross`, `tare`, `net`, `type`). |
| `GET`    | `/api/weighments/manual`    | List manual weighments with creator relations.                                           |
| `GET`    | `/api/tickets`              | List tickets for current factory. Supports status filter, search, sorting & pagination.  |
| `PATCH`  | `/api/tickets`              | Update ticket resolution status and reply.                                               |
| `DELETE` | `/api/tickets`              | Permanently delete a ticket (strictly permitted only when `status === 'pending'`).       |
| `GET`    | `/api/users`                | List staff users (Admin, Manager, Operator, Base) for current factory.                   |
| `POST`   | `/api/users`                | Create staff user accounts linked to current factory.                                    |
| `PATCH`  | `/api/users`                | Update staff user accounts.                                                              |
| `DELETE` | `/api/users`                | Hard-delete users (protected by `ON DELETE RESTRICT` against linked weighments/tickets). |

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
