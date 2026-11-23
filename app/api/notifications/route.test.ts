import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  EntryStatus,
  EntrySource,
  PermissionKey,
  ProjectSlug,
  Role,
  Unit,
  WeighmentType,
} from "@/lib/constants/enums";
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

const entryRow = (o: Record<string, unknown> = {}) => ({
  id: 1,
  vehicle_number: "UP32AB1234",
  detected_vehicle_number: "UP32AB1284",
  weight: 15000,
  status: EntryStatus.PENDING,
  auto_approved: false,
  created_at: "2026-11-24T10:00:00.000Z",
  centers: { name: "Center A", factory_id: 1 },
  created_by_user: { role: Role.HARDWARE },
  ...o,
});

const weighmentRow = (o: Record<string, unknown> = {}) => ({
  id: 10,
  unit: Unit.KG,
  type: WeighmentType.IN,
  created_at: "2026-11-24T11:00:00.000Z",
  in_entry: { weight: 15000, vehicle_number: "UP32AB1234", centers: { name: "Center A" } },
  out_entry: { weight: 5000 },
  ...o,
});

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
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

  it("maps entries and weighments and sorts newest first", async () => {
    const db = createMockSupabase({
      entries: createMockQueryBuilder({ data: [entryRow()] }),
      weighments: createMockQueryBuilder({ data: [weighmentRow()] }),
    });
    const res = await handler(req(), createMockUser(), db);
    const { data } = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([
      {
        kind: "weighment",
        id: 10,
        vehicle_number: "UP32AB1234",
        center_name: "Center A",
        created_at: "2026-11-24T11:00:00.000Z",
        in_weight: 15000,
        out_weight: 5000,
        net_weight: 10000,
        unit: Unit.KG,
        type: WeighmentType.IN,
      },
      {
        kind: "entry",
        id: 1,
        vehicle_number: "UP32AB1234",
        detected_vehicle_number: "UP32AB1284",
        center_name: "Center A",
        created_at: "2026-11-24T10:00:00.000Z",
        weight: 15000,
        status: EntryStatus.PENDING,
        auto_approved: false,
        source: EntrySource.DEVICE,
      },
    ]);
  });

  it("marks entries created by non-hardware users as manual", async () => {
    const db = createMockSupabase({
      entries: createMockQueryBuilder({
        data: [entryRow({ created_by_user: { role: Role.OPERATOR } })],
      }),
    });
    const { data } = await (await handler(req(), createMockUser(), db)).json();
    expect(data[0].source).toBe(EntrySource.MANUAL);
  });

  it("caps the merged list at 20 items", async () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      entryRow({ id: i + 1, created_at: new Date(Date.UTC(2026, 10, 24, 0, i)).toISOString() }),
    );
    const wRows = Array.from({ length: 20 }, (_, i) =>
      weighmentRow({
        id: i + 100,
        created_at: new Date(Date.UTC(2026, 10, 24, 1, i)).toISOString(),
      }),
    );
    const db = createMockSupabase({
      entries: createMockQueryBuilder({ data: rows }),
      weighments: createMockQueryBuilder({ data: wRows }),
    });
    const { data } = await (await handler(req(), createMockUser(), db)).json();
    expect(data).toHaveLength(20);
    expect(data.every((n: { kind: string }) => n.kind === "weighment")).toBe(true);
  });

  it("scopes both queries to the user's factory and the last 24 hours", async () => {
    const entries = createMockQueryBuilder({ data: [] });
    const weighments = createMockQueryBuilder({ data: [] });
    await handler(
      req(),
      createMockUser({ factory_id: 7 }),
      createMockSupabase({ entries, weighments }),
    );

    expect(entries.eq).toHaveBeenCalledWith("centers.factory_id", 7);
    expect(weighments.eq).toHaveBeenCalledWith("in_entry.centers.factory_id", 7);
    expect(entries.gte).toHaveBeenCalledWith("created_at", expect.any(String));
    expect(weighments.gte).toHaveBeenCalledWith("created_at", expect.any(String));
    expect(weighments.is).toHaveBeenCalledWith("in_entry.deleted_at", null);
    expect(entries.is).toHaveBeenCalledWith("deleted_at", null);
    expect(entries.limit).toHaveBeenCalledWith(20);
  });

  it("limits BASE users to their own customers", async () => {
    const entries = createMockQueryBuilder({ data: [] });
    const weighments = createMockQueryBuilder({ data: [] });
    await handler(
      req(),
      createMockUser({ role: Role.BASE, sub: "42" }),
      createMockSupabase({ entries, weighments }),
    );
    expect(entries.eq).toHaveBeenCalledWith("customers.user_id", 42);
    expect(weighments.eq).toHaveBeenCalledWith("in_entry.customers.user_id", 42);
  });

  it("skips the weighments query when the user cannot read weighments", async () => {
    mockHasPermission.mockImplementation((_u, slug) => slug === ProjectSlug.ENTRIES);
    const db = createMockSupabase({ entries: createMockQueryBuilder({ data: [] }) });
    await handler(req(), createMockUser(), db);
    expect(db.from).not.toHaveBeenCalledWith("weighments");
  });

  it("returns 500 when a query fails", async () => {
    const db = createMockSupabase({
      entries: createMockQueryBuilder({ error: { message: "boom" } }),
    });
    const res = await handler(req(), createMockUser(), db);
    expect(res.status).toBe(500);
  });
});
