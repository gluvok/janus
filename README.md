# GluVok / Mesto Weighbridge Platform

A centralized operational platform and automation management system for weighbridge facilities, featuring dual-mode (Automatic and Manual) weighments tracking, multi-scale support, role-based access control, and hardware integration.

---

## Architecture Overview

### Core Entities

- **Factories**: Master enterprise tenants managing scales, settings, and receipt formatting.
- **Centers**: Processing facilities and scale locations. Each center has an authenticated `api_key` for hardware scale and camera integration (hidden during `GET` requests).
- **Users**: System operators, managers, and administrators with argon2 password hashing.
- **Automatic Weighments**: Hardware/ANPR camera-captured vehicle weighments. Features PostgreSQL stored generated columns (`gross`, `tare`, `net`, `type`), inbound/outbound weights, timestamps, and camera image URLs.
- **Manual Weighments**: Operator-recorded weighments with full creator accountability (`in_creator_id`, `out_creator_id`).
- **Tickets**: Support and discrepancy tickets linked directly to `automatic_weighments`.

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

## API Routes

| Method   | Endpoint                    | Description                                                                               |
| :------- | :-------------------------- | :---------------------------------------------------------------------------------------- |
| `GET`    | `/api/centers`              | List centers (omits `api_key`). Supports pagination & sorting.                            |
| `POST`   | `/api/centers`              | Create a center. Generates and returns a 32-character `api_key`.                          |
| `PATCH`  | `/api/centers`              | Update center details.                                                                    |
| `GET`    | `/api/weighments/automatic` | List automatic weighments with stored generated fields (`gross`, `tare`, `net`, `type`).  |
| `POST`   | `/api/weighments/automatic` | Ingest vehicle weighing. Auto-matches open pending weighments or creates inbound records. |
| `PATCH`  | `/api/weighments/automatic` | Manually correct automatic weighment plates, weights, or centers.                         |
| `GET`    | `/api/weighments/manual`    | List manual weighments with creator relations.                                            |
| `POST`   | `/api/weighments/manual`    | Record operator weighment.                                                                |
| `PATCH`  | `/api/weighments/manual`    | Update manual weighment records.                                                          |
| `GET`    | `/api/users`                | List staff users (Admin, Manager, Operator, Base).                                        |
| `POST`   | `/api/users`                | Create staff user accounts.                                                               |
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
