# Gluvok

Industrial Weighing, Procurement & Multi-Tenant Center Management System.

---

## 1. Prerequisites & Environment

- **Runtime**: Node.js `v20+` and `pnpm v9+`
- Create `.env.local` with your Supabase credentials:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-service-role-key
```

---

## 2. How to Run

### Install Dependencies

```bash
pnpm install
```

### Database Schema Setup

For a new database instance, run the following SQL scripts in your Supabase SQL Editor:

1. `schema.sql` — provisions tables, enums, triggers, and RLS policies.
2. `storage.sql` — provisions the `gluvok` storage bucket and file access policies.
3. `data_api.sql` — provisions `api_key` on `factories` and the `factory_processed_weighments` table for the Factory Data API.

### Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
pnpm build
pnpm start
```

---

## 3. How to Seed Data for a New Client

### Optional: Reset Existing Data

If starting from scratch:

```bash
pnpm db:clear
```

### Seed Client Factory & Admin

Run the seed script with custom environment variables for the new client:

```bash
FACTORY_NAME="Client Factory Name" \
CENTER_NAME="Main Center" \
ADMIN_USERNAME="clientadmin" \
ADMIN_PASSWORD="securepassword123" \
pnpm seed
```

**Environment Variables for Seeding:**

| Variable         | Description                    | Default if Omitted |
| :--------------- | :----------------------------- | :----------------- |
| `FACTORY_NAME`   | Name of the tenant factory     | `Default Factory`  |
| `CENTER_NAME`    | Primary collection center name | `Main Center`      |
| `ADMIN_USERNAME` | Admin account username         | `admin1`           |
| `ADMIN_PASSWORD` | Admin account password         | `admin123`         |
| `ADMIN_NAME`     | Display name of the admin user | `Admin User 1`     |

**What Gets Created:**

- **Factory & Center**: Configures the tenant factory and collection center.
- **Admin User**: Created with the specified username/password (Role: `admin`).
- **Hardware Edge Users**: Usernames `pi1`, `pi2`, Password `hardware123` (Role: `hardware`).
- **Commodities**: Default commodity catalog (Wheat, Scrap Copper, Corn, etc.).

### Seed Only Admin User

If you only want to create or reset an admin user without touching centers, commodities, or devices, run `pnpm seed:admin` with the target `factory_id` as the only argument (it seeds username `admin` and password `admin123`):

```bash
pnpm seed:admin <factory_id>

# Example:
pnpm seed:admin 3
```

### Optional: Full QA / Test Dataset

To seed full rich multi-factory fixtures (entries, tickets, weighments):

```bash
pnpm seed:test
```

---

## 4. Image Preprocessing (Camera Crop)

All images submitted via `POST /api/entries` are preprocessed by `sharp` before being saved to Supabase Storage:

- **Camera ordering**: Send files as `camera_1`, `camera_2` (preferred) or `files[]` (positional fallback). The first file is always treated as Camera 1, the second as Camera 2.
- **Per-factory crop**: Each factory stores a `camera_crops` JSONB column defining percentage-based crop insets (top/bottom/left/right, 0–100) per camera. Default values are derived from visual analysis of the factory's IP camera feeds.
- **Output**: Cropped JPEG at quality 85, re-uploaded in place.

### Database Migration

For existing databases, run the following to add the new columns:

```bash
psql "$DATABASE_URL" -f migrate_factory_crops.sql
```

### Retroactive Crop of Existing Images

To apply crop configs to images already stored in the bucket:

```bash
# Dry run first (no writes)
pnpm crop:images --dry-run

# Live run for all factories
pnpm crop:images

# Live run for a specific factory
pnpm crop:images --factory-id 1
```

---

## 5. Factory Settings

Configurable via the **Settings** page (admin-only):

| Setting                      | Description                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| **Factory Name**             | Display name used in receipts and PDF exports                        |
| **Check Center on Merge**    | Whether to enforce center consistency when merging weighment entries |
| **Weighment Receipt Layout** | Number of camera images per row on printed receipts (1–4)            |

> Camera crop coordinates are managed server-side in the `camera_crops` DB column and are not exposed in the UI.

---

## 6. Performance & Session Caching

- **In-Memory Session Cache (`lru-cache`)**: Incoming HTTP requests validate session tokens against an in-memory LRU cache (1-hour TTL, max 5,000 entries) before querying the database, eliminating 90%+ of redundant auth queries.
- **Entry & Weighment Factory Scoping**: The `entries` table does not maintain a direct `factory_id` column. Multi-tenant scoping for entries and weighments is enforced via linked physical collection centers (`entries.center_id -> centers.factory_id`), keeping tenant isolation clean and relational.
- **Instant Invalidation**: Password changes, username/name/role updates, user deactivations, logouts, and factory setting updates (such as factory name and weighment receipt layout) trigger immediate cache eviction via reverse user and factory indexes for zero-delay consistency.
- **PostgreSQL Trigram & Composite Indexes**: `schema.sql` includes `pg_trgm` GIN indexes for fast text filtering and composite covering indexes for sequential approval and sorting.

---

## 7. Role-Based Access Control (RBAC) & Account Management

- **Admin**: Full administrative management (manages Operator & Base users, soft-deletes users, updates factory settings).
- **Manager**: Operational management (views Users, Rates, Settings, Tickets, Customers, Entries, Weighments; can create/edit Operator & Base users and customers; user deletion disabled).
- **Operator**: Operational execution (shares Manager view access across Users, Rates, Settings, Tickets, Customers, Entries, Weighments; can edit Base users and self; user creation/deletion disabled; settings read-only).
- **Base**: Field worker (views Entries and Weighments; manages own credentials via `/account`).
- **Hardware**: Edge device integration (API-only for automated entry creation).

### Self-Service Account Management (`/account`)

All authenticated users can access the `/account` portal from the sidebar user menu to:

- Update their display name and unique username.
- Update their password with instant multi-session invalidation.
- View their current assigned system role and factory affiliation.

---

## 8. Factory Data API (`/api/data`)

The `/api/data` endpoint provides an external integration route for third-party systems and factories to fetch weighments with linked entries and flattened metrics.

### Authentication & Headers

| Header           | Type                | Description                                                                                                                                                 |
| :--------------- | :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-api-key`      | `string` (Required) | Factory API key used to resolve tenant scope.                                                                                                               |
| `x-processed-id` | `number` (Optional) | ID of the last processed weighment. The server records this ID in `factory_processed_weighments` and excludes all recorded processed IDs from the response. |

### Stateful Processing Workflow

1. **Initial Call**: Client requests `/api/data` with only `x-api-key`. Because no IDs have been marked processed yet, the server returns the entire active weighment list.
2. **Subsequent Calls**: When the client has processed a weighment (e.g. ID #10), it sends `x-processed-id: 10`. The server records ID 10 and returns all weighments except ID 10.
3. **Cumulative Exclusion**: When the client processes ID #8 and sends `x-processed-id: 8`, the server records ID 8 and returns all weighments except both ID 10 and ID 8.
4. **Fetching Remaining**: If the client calls without `x-processed-id`, the server continues to exclude all previously recorded processed IDs, returning only the remaining un-processed weighments.

```bash
# Initial fetch
curl -H "x-api-key: your-factory-api-key" https://your-domain.com/api/data

# Acknowledging processed weighment ID 10
curl -H "x-api-key: your-factory-api-key" \
     -H "x-processed-id: 10" \
     https://your-domain.com/api/data
```

If the `x-api-key` header is missing or does not match an active factory record in the database, the endpoint returns `401 Unauthorized`.

### Response Format

Returns HTTP 200 with record count and an array of thin flattened weighment records (see [docs/data_curl.md](docs/data_curl.md) for full cURL guide):

```json
{
  "data": [
    {
      "id": 101,
      "vehicle_number": "KA-01-AB-1234",
      "gross_weight": 15000,
      "tare_weight": 5000,
      "net_weight": 10000,
      "in_entry_id": 11,
      "in_entry_time": "2026-10-26T09:30:00.000Z",
      "out_entry_id": 12,
      "out_entry_time": "2026-10-26T10:45:00.000Z",
      "in_center_id": 1,
      "in_center_name": "Weighbridge North",
      "out_center_id": 1,
      "out_center_name": "Weighbridge North"
    }
  ],
  "count": 1
}
```

---

## 9. Verification Gates

```bash
pnpm run lint:fix && pnpm run fmt:check && pnpm run type-check && pnpm test && pnpm run build
```
