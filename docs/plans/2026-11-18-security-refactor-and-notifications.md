# Security Hardening, Clean Code Refactor & Real-Time Notification Box Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all identified database, authorization, and injection vulnerabilities in Janus, clean up code smells without dependency/version drift, and implement an in-app real-time notification box for incoming weighbridge entries.

**Architecture:** 
1. Database & SQL Security: Revoke public execution of superuser stored procedures, add `SET search_path = public, pg_temp;` to all `SECURITY DEFINER` functions, and sanitize PostgREST filter parameters to eliminate AST injection.
2. Backend & Clean Code: Fix cross-tenant IDOR in weighment updates with strict tenant joins, strip test backdoors from production route signatures, and enforce file extension whitelisting on uploads.
3. Consumer Notification Box: Use Supabase Realtime (`postgres_changes` on `entries`) combined with an unread-badge Zustand store, Sonner toasts, and a Radix Popover UI component in the global header—using 100% existing dependencies (Ponytail ladder).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, PostgreSQL (Supabase), Zustand, Radix UI, Sonner, Vitest, oxlint.

---

## Vulnerability Disclosure Matrix

| Vulnerability | Severity | CWE | File Location | Root Cause & Fix |
| :--- | :--- | :--- | :--- | :--- |
| **Superuser RPC Exposure** | CRITICAL | CWE-250 | `schema.sql:459-495, 621` | `reset_all_sequences` & `delete_customers_with_user` granted to `PUBLIC`. Revoke execute from `PUBLIC`, `anon`, `authenticated`. |
| **Search Path Hijacking** | HIGH | CWE-426 | `schema.sql:462, 480, 512, 558, 626, 660, 731, 775, 832` | 9 `SECURITY DEFINER` functions lack `search_path`. Add `SET search_path = public, pg_temp;`. |
| **Cross-Tenant IDOR** | CRITICAL | CWE-639 | `app/api/weighments/[id]/route.ts:65` | `PATCH` fetch query lacks `factory_id` scoping. Join `in_entry` and filter on `factory_id`. |
| **PostgREST AST Injection** | HIGH | CWE-89 / CWE-707 | `app/api/entries/route.ts:89`, `customers/route.ts:43`, etc. | Unescaped search string inside `.or(...)`. Sanitize structural PostgREST tokens `()`, `,`, `.`. |
| **Unvalidated Upload Ext** | HIGH | CWE-434 | `lib/services/storage.ts:50-58` | Skips check if `file.type` is empty; uses unvalidated `file.name` extension. Whitelist `jpg, jpeg, png, webp`. |
| **Test Backdoors in Prod** | MEDIUM | CWE-511 | `app/api/entries/route.ts:129-153` | Production route signature takes `...rest: unknown[]` to mock user payloads. Refactor to clean handler. |
| **Permissive RLS Policies** | HIGH | CWE-284 | `schema.sql:445-455` | 11 tables have `FOR ALL USING (true)`. Enforce service-role or tenant-scoped policies. |

---

## Folder Structure Analysis & Recommendations

* **Dead Artifact Removal**: Delete `migration.md` (73 KB copy-pasted TanStack Table tutorial having zero relation to database migrations).
* **Colocation Discipline**:
  * Store notification logic under `lib/store/notifications.ts` and `hooks/use-entry-notifications.ts`.
  * Store UI component in `components/notifications/notification-box.tsx`.
* **Zero Dependency Drift**: Strict freeze on `package.json` versions. No additions or downgrades.

---

### Task 1: Clean Dead Files & Add Version Conflict Verification Test
**Skills**: `@senior-devops`, `@senior-qa`, `@ponytail`

**Files:**
- Delete: `migration.md`
- Create: `tests/version-conflict.test.ts`
- Create: `scripts/verify-versions.ts`

**Step 1: Write the failing test**
Create `tests/version-conflict.test.ts` to assert package lockfile integrity and prevent dependency drift:
```typescript
import { describe, it, expect } from "vitest";
import packageJson from "../package.json";
import fs from "fs";
import path from "path";

describe("Version Conflict & Dependency Integrity", () => {
  it("enforces exact locked major dependencies without unexpected drift", () => {
    const deps = packageJson.dependencies as Record<string, string>;
    expect(deps["next"]).toBe("16.3.6");
    expect(deps["react"]).toBe("19.3.0");
    expect(deps["@supabase/supabase-js"]).toBe("^2.117.1");
    expect(deps["zustand"]).toBe("^5.0.15");
    expect(deps["zod"]).toBe("^4.6.5");
  });

  it("verifies pnpm-lock.yaml exists and no rogue npm/yarn locks are present", () => {
    const root = path.resolve(__dirname, "..");
    expect(fs.existsSync(path.join(root, "pnpm-lock.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(root, "package-lock.json"))).toBe(false);
    expect(fs.existsSync(path.join(root, "yarn.lock"))).toBe(false);
  });

  it("confirms dead migration.md artifact is deleted", () => {
    const root = path.resolve(__dirname, "..");
    expect(fs.existsSync(path.join(root, "migration.md"))).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test tests/version-conflict.test.ts`
Expected: FAIL (because `migration.md` still exists).

**Step 3: Remove dead file and add verification script**
```bash
rm /Users/kaalu/importante/janus/migration.md
```
Create `scripts/verify-versions.ts`:
```typescript
import { execSync } from "child_process";

console.log("Checking lockfile and typescript version alignment...");
try {
  execSync("pnpm type-check", { stdio: "inherit" });
  execSync("pnpm lint", { stdio: "inherit" });
  console.log("Version alignment check passed with 0 errors.");
} catch (error) {
  console.error("Version conflict or type error detected!");
  process.exit(1);
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test tests/version-conflict.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add tests/version-conflict.test.ts scripts/verify-versions.ts
git rm migration.md
git commit -m "chore: remove dead migration doc and add version conflict test"
```

---

### Task 2: Hardening Superuser SQL Procedures & Revoking Public RPC
**Skills**: `@sql-pro`, `@senior-security`

**Files:**
- Modify: `schema.sql:458-498, 621-650`
- Create: `tests/db/schema-security.test.ts`

**Step 1: Write the failing test**
Create `tests/db/schema-security.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Database Schema Security Hardening", () => {
  const schemaSql = fs.readFileSync(path.resolve(__dirname, "../../schema.sql"), "utf-8");

  it("ensures reset_all_sequences revokes execution from PUBLIC and anon", () => {
    expect(schemaSql).toMatch(/REVOKE ALL ON FUNCTION reset_all_sequences\(\) FROM PUBLIC, anon;/i);
  });

  it("ensures reset_table_sequence revokes execution from PUBLIC and anon", () => {
    expect(schemaSql).toMatch(/REVOKE ALL ON FUNCTION reset_table_sequence\(text\) FROM PUBLIC, anon;/i);
  });

  it("enforces SET search_path on all SECURITY DEFINER procedures", () => {
    const secDefinerMatches = schemaSql.match(/SECURITY DEFINER[\s\S]*?AS \$\$/g) || [];
    for (const match of secDefinerMatches) {
      expect(match).toMatch(/SET search_path\s*=\s*(public,\s*pg_temp|pg_temp,\s*public)/i);
    }
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test tests/db/schema-security.test.ts`
Expected: FAIL (revocations and search_path missing).

**Step 3: Modify `schema.sql`**
Add `SET search_path = public, pg_temp;` and explicit `REVOKE` statements to:
- `reset_table_sequence(table_name text)`
- `reset_all_sequences()`
- `create_customer_with_user(...)`
- `update_customer_with_user(...)`
- `delete_customers_with_user(...)`
- `get_factory_weighment_data(...)`
- `acknowledge_factory_weighment(...)`
- `get_factory_entry_data(...)`
- `acknowledge_factory_entry(...)`

Append revocations:
```sql
REVOKE ALL ON FUNCTION reset_table_sequence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reset_table_sequence(text) TO service_role;

REVOKE ALL ON FUNCTION reset_all_sequences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reset_all_sequences() TO service_role;

REVOKE ALL ON FUNCTION delete_customers_with_user(INT[], INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_customers_with_user(INT[], INT) TO authenticated, service_role;
```

**Step 4: Run test to verify it passes**
Run: `pnpm test tests/db/schema-security.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add schema.sql tests/db/schema-security.test.ts
git commit -m "security(db): revoke public execute on superuser RPCs and set search_path"
```

---

### Task 3: Sanitize PostgREST AST Filter Injection
**Skills**: `@sql-pro`, `@senior-security`, `@clean-code`

**Files:**
- Modify: `lib/services/common.ts`
- Modify: `app/api/entries/route.ts:85-91`
- Modify: `app/api/customers/route.ts:41-47`
- Modify: `app/api/tickets/route.ts:72-82`
- Modify: `app/api/rates/route.ts:51-59`
- Modify: `app/api/users/route.ts:46-52`
- Modify: `app/api/centers/route.ts:32-36`
- Test: `lib/services/common.test.ts`

**Step 1: Write the failing test**
In `lib/services/common.test.ts`:
```typescript
import { sanitizeSearchTerm } from "@/lib/services/common";

describe("sanitizeSearchTerm", () => {
  it("strips PostgREST AST injection characters and operators", () => {
    const raw = "KA01AB1234),id.gt.0,name.eq.foo";
    const cleaned = sanitizeSearchTerm(raw);
    expect(cleaned).toBe("KA01AB1234idgt0nameeqfoo");
    expect(cleaned).not.toContain(",");
    expect(cleaned).not.toContain(")");
    expect(cleaned).not.toContain("(");
    expect(cleaned).not.toContain(".");
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test lib/services/common.test.ts`
Expected: FAIL (`sanitizeSearchTerm is not defined`).

**Step 3: Implement `sanitizeSearchTerm` in `lib/services/common.ts`**
```typescript
/**
 * Strips PostgREST structural syntax characters to prevent filter AST injection in .or() clauses.
 */
export function sanitizeSearchTerm(term: string): string {
  if (!term || typeof term !== "string") return "";
  // Strip parentheses, commas, quotes, colons, and dots used in PostgREST operators
  return term.replace(/[(),."':;\\]/g, "").trim();
}
```
Apply `sanitizeSearchTerm` to `search` parameters across `entries`, `customers`, `tickets`, `rates`, `users`, and `centers`.

**Step 4: Run test to verify it passes**
Run: `pnpm test lib/services/common.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add lib/services/common.ts lib/services/common.test.ts app/api/
git commit -m "fix(security): sanitize search params against PostgREST filter injection"
```

---

### Task 4: Fix Cross-Tenant IDOR on Weighment Modifications
**Skills**: `@senior-backend`, `@senior-security`, `@senior-qa`

**Files:**
- Modify: `app/api/weighments/[id]/route.ts:65-75`
- Test: `app/api/weighments/[id]/route.test.ts`

**Step 1: Write the failing test**
Add to `app/api/weighments/[id]/route.test.ts`:
```typescript
it("rejects PATCH when weighment belongs to a different factory (IDOR guard)", async () => {
  const req = new NextRequest("http://localhost/api/weighments/999", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "in" }),
  });

  // User belongs to factory 1, weighment belongs to factory 2
  const user = { sub: "10", role: "admin", factory_id: 1 };
  const ctx = { params: Promise.resolve({ id: "999" }) };
  const res = await PATCH(req, user as any, mockSupabase as any, ctx);
  expect(res.status).toBe(StatusCodes.NOT_FOUND);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test app/api/weighments/[id]/route.test.ts`
Expected: FAIL (currently permits update without factory scope).

**Step 3: Enforce `factory_id` scoping in `app/api/weighments/[id]/route.ts`**
```typescript
  // 1. Fetch existing weighment strictly scoped to user's factory_id
  const { data: existing, error: fetchErr } = await client
    .from("weighments")
    .select("id, rate_id, type, in_entry:entries!in_entry_id!inner(center_id, centers!inner(factory_id))")
    .eq("id", weighmentId)
    .eq("in_entry.centers.factory_id", user.factory_id!)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr || !existing) {
    return apiError(ApiErrorMessage.WEIGHMENT_NOT_FOUND, StatusCodes.NOT_FOUND);
  }
```

**Step 4: Run test to verify it passes**
Run: `pnpm test app/api/weighments/[id]/route.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add app/api/weighments/[id]/route.ts app/api/weighments/[id]/route.test.ts
git commit -m "fix(security): enforce tenant isolation on weighment updates"
```

---

### Task 5: Eliminate Test Mock Backdoors in Production Code
**Skills**: `@clean-code`, `@senior-backend`, `@ponytail`

**Files:**
- Modify: `app/api/entries/route.ts:129-178`
- Modify: `app/api/entries/route.test.ts`

**Step 1: Write test verifying standard NextRequest dispatch**
Update `app/api/entries/route.test.ts` to mock request headers and cookies directly rather than passing mock user objects into `...rest`.

**Step 2: Run test to verify it fails**
Run: `pnpm test app/api/entries/route.test.ts`
Expected: FAIL.

**Step 3: Clean `POST` signature in `app/api/entries/route.ts`**
Remove `...rest: unknown[]` and the `rest[0]` role check. Production route signatures must strictly be:
```typescript
export async function POST(req: NextRequest) {
  // Pure production authentication via device basic auth or getAuthUser(req)
```

**Step 4: Run test to verify it passes**
Run: `pnpm test app/api/entries/route.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add app/api/entries/route.ts app/api/entries/route.test.ts
git commit -m "refactor(clean-code): strip testing mock backdoors from entries route signature"
```

---

### Task 6: Strict File Upload Whitelisting
**Skills**: `@senior-security`, `@senior-backend`

**Files:**
- Modify: `lib/services/storage.ts:13-22, 50-60`
- Test: `lib/services/storage.test.ts`

**Step 1: Write the failing test**
In `lib/services/storage.test.ts`:
```typescript
it("rejects files with missing mime type or unwhitelisted extension", async () => {
  const fakeHtmlFile = new File(["<script>alert(1)</script>"], "payload.html", { type: "" });
  await expect(uploadFilesToStorage([fakeHtmlFile], 1)).rejects.toThrow(/Invalid image file/i);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test lib/services/storage.test.ts`
Expected: FAIL.

**Step 3: Whitelist extensions in `lib/services/storage.ts`**
```typescript
export const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

// In uploadFilesToStorage:
const fileExt = file.name ? file.name.split(".").pop()?.toLowerCase() || "" : "";
if (!ALLOWED_EXTENSIONS.has(fileExt) || !ALLOWED_MIME_TYPES.has(file.type?.toLowerCase() || "")) {
  throw new Error(`Invalid image file "${file.name}". Only JPEG, PNG, and WebP files are permitted.`);
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test lib/services/storage.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add lib/services/storage.ts lib/services/storage.test.ts
git commit -m "fix(security): enforce strict extension and MIME verification on uploads"
```

---

### Task 7: Notification Store (`lib/store/notifications.ts`)
**Skills**: `@senior-fullstack`, `@ponytail`

**Files:**
- Create: `lib/store/notifications.ts`
- Create: `lib/store/notifications.test.ts`

**Step 1: Write the failing test**
Create `lib/store/notifications.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useNotificationStore } from "./notifications";

describe("Notification Store", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  it("adds notification, increments unreadCount, and marks read", () => {
    useNotificationStore.getState().addNotification({
      id: "entry-101",
      entryId: 101,
      title: "New Weighment Entry",
      vehicleNumber: "RJ09GA0165",
      weight: 14200,
      centerName: "North Yard",
      createdAt: new Date().toISOString(),
    });

    expect(useNotificationStore.getState().unreadCount).toBe(1);
    expect(useNotificationStore.getState().notifications.length).toBe(1);

    useNotificationStore.getState().markAsRead("entry-101");
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test lib/store/notifications.test.ts`
Expected: FAIL (`useNotificationStore is not defined`).

**Step 3: Implement `lib/store/notifications.ts`**
```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface EntryNotification {
  id: string;
  entryId: number;
  title: string;
  vehicleNumber: string;
  weight: number;
  centerName: string;
  createdAt: string;
  read: boolean;
}

interface NotificationState {
  notifications: EntryNotification[];
  unreadCount: number;
  addNotification: (item: Omit<EntryNotification, "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      unreadCount: 0,
      addNotification: (item) =>
        set((state) => {
          if (state.notifications.some((n) => n.id === item.id)) return state;
          const updated = [{ ...item, read: false }, ...state.notifications].slice(0, 50);
          return { notifications: updated, unreadCount: state.unreadCount + 1 };
        }),
      markAsRead: (id) =>
        set((state) => {
          const updated = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
          const unread = updated.filter((n) => !n.read).length;
          return { notifications: updated, unreadCount: unread };
        }),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),
      clearAll: () => set({ notifications: [], unreadCount: 0 }),
    }),
    { name: "gluvok-notifications" },
  ),
);
```

**Step 4: Run test to verify it passes**
Run: `pnpm test lib/store/notifications.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add lib/store/notifications.ts lib/store/notifications.test.ts
git commit -m "feat: add persistent notification state store"
```

---

### Task 8: Supabase Realtime Entry Listener Hook
**Skills**: `@senior-fullstack`, `@senior-security`, `@ponytail`

**Files:**
- Create: `hooks/use-entry-notifications.ts`
- Test: `tests/hooks/use-entry-notifications.test.ts`

**Step 1: Write the failing test**
Create `tests/hooks/use-entry-notifications.test.ts` asserting subscription to `postgres_changes` on `entries` table and trigger of toast notification.

**Step 2: Run test to verify it fails**
Run: `pnpm test tests/hooks/use-entry-notifications.test.ts`
Expected: FAIL.

**Step 3: Implement `hooks/use-entry-notifications.ts`**
```typescript
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNotificationStore } from "@/lib/store/notifications";
import { useAuthStore } from "@/lib/store";
import { toast } from "sonner";

export function useEntryNotifications() {
  const user = useAuthStore((s) => s.user);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!user || !user.factory_id) return;

    const channel = supabase
      .channel("realtime-entries")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "entries",
        },
        (payload) => {
          const newEntry = payload.new as {
            id: number;
            vehicle_number?: string;
            detected_vehicle_number?: string;
            weight?: number;
            center_id?: number;
            created_at?: string;
          };

          const plate = newEntry.vehicle_number || newEntry.detected_vehicle_number || "Unidentified";
          const weightKg = newEntry.weight ? `${newEntry.weight.toLocaleString()} kg` : "0 kg";

          addNotification({
            id: `entry-${newEntry.id}`,
            entryId: newEntry.id,
            title: "New Vehicle Entry",
            vehicleNumber: plate,
            weight: newEntry.weight || 0,
            centerName: `Center #${newEntry.center_id || 1}`,
            createdAt: newEntry.created_at || new Date().toISOString(),
          });

          toast.info(`New Weighment Entry: ${plate}`, {
            description: `Weight: ${weightKg}`,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addNotification]);
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test tests/hooks/use-entry-notifications.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add hooks/use-entry-notifications.ts tests/hooks/use-entry-notifications.test.ts
git commit -m "feat(realtime): subscribe to entries insertion events with toast notification"
```

---

### Task 9: Real-Time Consumer Notification Box UI Component
**Skills**: `@senior-fullstack`, `@clean-code`, `@ponytail`

**Files:**
- Create: `components/notifications/notification-box.tsx`
- Test: `components/notifications/notification-box.test.tsx`

**Step 1: Write component test**
Create `components/notifications/notification-box.test.tsx` verifying:
1. Renders Bell button with unread count badge.
2. Clicking open reveals the notifications popover with entries.
3. Clicking "Mark all read" updates state.

**Step 2: Run test to verify it fails**
Run: `pnpm test components/notifications/notification-box.test.tsx`
Expected: FAIL.

**Step 3: Implement `components/notifications/notification-box.tsx`**
(Uses existing `lucide-react` icons and `radix-ui` / shadcn `Popover` without adding new packages):
```tsx
"use client";

import * as React from "react";
import { Bell, CheckCheck, Truck, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificationStore } from "@/lib/store/notifications";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export function NotificationBox() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 sm:w-96" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground">
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No entries received yet
            </div>
          ) : (
            notifications.map((item) => (
              <Link
                key={item.id}
                href={`/projects/entries?search=${encodeURIComponent(item.vehicleNumber)}`}
                onClick={() => markAsRead(item.id)}
                className={`flex items-start gap-3 p-3 transition-colors hover:bg-muted/50 ${
                  !item.read ? "bg-muted/20 font-medium" : ""
                }`}
              >
                <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  <Truck className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{item.vehicleNumber}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Scale className="h-3 w-3" /> {item.weight.toLocaleString()} kg &bull; {item.centerName}
                  </div>
                </div>
                {!item.read && <span className="h-2 w-2 rounded-full bg-primary" />}
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test components/notifications/notification-box.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add components/notifications/notification-box.tsx components/notifications/notification-box.test.tsx
git commit -m "feat(ui): add consumer notification center popover"
```

---

### Task 10: Mount Notification Center in Navigation Bar
**Skills**: `@senior-fullstack`, `@clean-code`

**Files:**
- Modify: `components/projects/header.tsx:30-64`
- Modify: `components/layout-wrapper.tsx:20-39`

**Step 1: Mount `useEntryNotifications` listener in `components/layout-wrapper.tsx`**
Invoke `useEntryNotifications()` inside `MainLayout` so the Realtime listener runs on all authenticated routes.

**Step 2: Mount `<NotificationBox />` in `components/projects/header.tsx`**
Place `<NotificationBox />` at `ml-auto mr-4` in the project header.

**Step 3: Run end-to-end component tests**
Run: `pnpm test components/projects/header.test.tsx` (or route tests).
Expected: PASS

**Step 4: Commit**
```bash
git add components/projects/header.tsx components/layout-wrapper.tsx
git commit -m "feat: wire realtime notification listener and header bell icon"
```

---

### Task 11: ECC Verification Loop & Lockfile Audit
**Skills**: `@senior-devops`, `@senior-qa`

**Step 1: Run TypeScript strict typecheck**
Run: `pnpm type-check`
Expected: 0 errors, 0 warnings.

**Step 2: Run linter**
Run: `pnpm lint`
Expected: 0 errors.

**Step 3: Run full test suite**
Run: `pnpm test`
Expected: 100% tests pass.

**Step 4: Run Version Conflict verification**
Run: `pnpm tsx scripts/verify-versions.ts`
Expected: Exit code 0, 0 version conflicts.

**Step 5: Final Clean Commit**
```bash
git status
git commit -m "chore(release): complete security hardening, clean code refactor, and notification center"
```
