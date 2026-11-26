import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { PermissionKey, ProjectSlug, Role, Unit } from "@/lib/constants/enums";
import { createMockQueryBuilder, createMockSupabase, createMockUser } from "@/tests/test-utils";

const { mockHasPermission } = vi.hoisted(() => ({ mockHasPermission: vi.fn() }));

vi.mock("@/db/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/helpers")>();
  return { ...actual, withAuth: <T>(h: T) => h, hasPermission: mockHasPermission };
});

import { GET } from "./route";

type RawHandler = (req: NextRequest, user: unknown, db: unknown) => Promise<Response>;
const handler = GET as unknown as RawHandler;
const req = () => new NextRequest("http://localhost/api/notifications");

const NOW = "2026-11-24T12:00:00.000Z";
const SEEN_AT = "2026-11-24T09:00:00.000Z";

const row = (o: Record<string, unknown> = {}) => ({
  kind: "weighment",
  ref_id: 10,
  vehicle_number: "UP32AB1234",
  weight: "1000.00",
  unit: Unit.KG,
  created_at: "2026-11-24T11:00:00.000Z",
  ...o,
});

const setup = (rows: unknown[] = []) => {
  const notifications = createMockQueryBuilder({ data: rows });
  const users = createMockQueryBuilder({ maybeSingleData: { notifications_seen_at: SEEN_AT } });
  return { notifications, users, db: createMockSupabase({ notifications, users }) };
};

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    mockHasPermission.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 403 when the user can read neither entries nor weighments", async () => {
    mockHasPermission.mockReturnValue(false);
    const res = await handler(req(), createMockUser(), createMockSupabase());
    expect(res.status).toBe(403);
    expect(mockHasPermission).toHaveBeenCalledWith(
      expect.anything(),
      ProjectSlug.ENTRIES,
      PermissionKey.READ,
    );
  });

  it("reads the last 24h of notifications, newest 20, with numeric weight and seenAt", async () => {
    const { notifications, users, db } = setup([row()]);
    const res = await handler(req(), createMockUser({ sub: "5" }), db);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.from).toHaveBeenCalledWith("notifications");
    expect(notifications.gte).toHaveBeenCalledWith("created_at", "2026-11-23T12:00:00.000Z");
    expect(notifications.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(notifications.limit).toHaveBeenCalledWith(20);
    expect(users.eq).toHaveBeenCalledWith("id", 5);
    expect(body).toEqual({
      data: [
        {
          kind: "weighment",
          ref_id: 10,
          vehicle_number: "UP32AB1234",
          weight: 1000,
          unit: Unit.KG,
          created_at: "2026-11-24T11:00:00.000Z",
        },
      ],
      seenAt: SEEN_AT,
    });
  });

  it("scopes staff to their factory, never by customer", async () => {
    const { notifications, db } = setup();
    await handler(req(), createMockUser({ role: Role.OPERATOR, factory_id: 7 }), db);
    expect(notifications.eq).toHaveBeenCalledWith("factory_id", 7);
    expect(notifications.eq).not.toHaveBeenCalledWith("customer_user_id", expect.anything());
  });

  it("scopes BASE users to their own customer rows, never by factory", async () => {
    const { notifications, db } = setup();
    await handler(req(), createMockUser({ role: Role.BASE, sub: "42", factory_id: 7 }), db);
    expect(notifications.eq).toHaveBeenCalledWith("customer_user_id", 42);
    expect(notifications.eq).not.toHaveBeenCalledWith("factory_id", expect.anything());
  });

  it("filters to entries when the user can read only entries", async () => {
    mockHasPermission.mockImplementation((_u, slug) => slug === ProjectSlug.ENTRIES);
    const { notifications, db } = setup();
    await handler(req(), createMockUser(), db);
    expect(notifications.eq).toHaveBeenCalledWith("kind", "entry");
    expect(notifications.eq).not.toHaveBeenCalledWith("kind", "weighment");
  });

  it("returns 500 when the query fails", async () => {
    const db = createMockSupabase({
      notifications: createMockQueryBuilder({ error: { message: "boom" } }),
    });
    const res = await handler(req(), createMockUser(), db);
    expect(res.status).toBe(500);
  });
});
