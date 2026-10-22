import { describe, expect, it, vi, beforeEach } from "vitest";
import { PermissionKey, ProjectSlug, Unit, WeighmentType } from "@/lib/constants/enums";
import { NextRequest } from "next/server";
import {
  createMockQueryBuilder,
  createMockSupabase,
  createMockUser,
  createMockWeighment,
} from "@/tests/test-utils";

const { mockHasPermission } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
}));

vi.mock("@/db/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/helpers")>();
  return {
    ...actual,
    withAuth: <T>(handler: T) => handler,
    hasPermission: mockHasPermission,
  };
});

import { GET, DELETE } from "./route";

type RawHandler = (
  request: NextRequest,
  user: ReturnType<typeof createMockUser>,
  db: unknown,
  context?: unknown,
) => Promise<Response>;

const sampleUser = createMockUser();

describe("GET /api/weighments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
  });

  it("rejects when user lacks READ permission", async () => {
    mockHasPermission.mockReturnValue(false);
    const req = new NextRequest("http://localhost/api/weighments");
    const handler = GET as unknown as RawHandler;
    const response = await handler(req, sampleUser, {});

    expect(response.status).toBe(403);
    expect(mockHasPermission).toHaveBeenCalledWith(
      sampleUser,
      ProjectSlug.WEIGHMENTS,
      PermissionKey.READ,
    );
  });

  it("returns formatted list of weighments", async () => {
    const mockDb = createMockSupabase({
      weighments: createMockQueryBuilder({
        data: [
          createMockWeighment({
            id: 10,
            unit: Unit.KG,
            type: WeighmentType.UNASSIGNED,
            rate_id: 5,
            in_entry_id: 1,
            out_entry_id: 2,
            in_entry: {
              center_id: 1,
              weight: 15000,
              vehicle_number: "KA01AB1234",
              centers: { name: "Center A" },
              users: { name: "Operator 1" },
              customers: { name: "Farmer 1" },
            },
            out_entry: {
              center_id: 1,
              weight: 5000,
              vehicle_number: "KA01AB1234",
              centers: { name: "Center A" },
              users: { name: "Operator 2" },
              customers: { name: "Farmer 1" },
            },
          }),
        ],
        count: 1,
      }),
    });

    const req = new NextRequest("http://localhost/api/weighments?page=1&limit=10");
    const handler = GET as unknown as RawHandler;
    const response = await handler(req, sampleUser, mockDb);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].gross_weight).toBe(15000);
    expect(json.data[0].tare_weight).toBe(5000);
    expect(json.data[0].net_weight).toBe(10000);
    expect(json.data[0].in_center_name).toBe("Center A");
    expect(json.data[0].in_center_id).toBe(1);
    expect(json.data[0].rate_id).toBe(5);
  });

  it("uses !inner on in_entry and returns empty list with 200 when no weighments exist for factory", async () => {
    const weighmentsQuery = createMockQueryBuilder({ data: [], count: 0 });
    const mockDb = createMockSupabase({ weighments: weighmentsQuery });

    const req = new NextRequest("http://localhost/api/weighments?page=1&limit=10");
    const handler = GET as unknown as RawHandler;
    const response = await handler(req, sampleUser, mockDb);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toEqual([]);
    expect(json.pagination.total).toBe(0);
    expect(weighmentsQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("in_entry:entries!in_entry_id!inner"),
      { count: "exact" },
    );
  });

  it("filters by user_id using entry ID pre-resolution without PostgREST syntax error", async () => {
    const weighmentsQuery = createMockQueryBuilder({ data: [], count: 0 });

    const mockDb = createMockSupabase({
      entries: createMockQueryBuilder({ data: [{ id: 101 }, { id: 102 }] }),
      weighments: weighmentsQuery,
    });

    const req = new NextRequest("http://localhost/api/weighments?user_id=5&page=1&limit=10");
    const handler = GET as unknown as RawHandler;
    const response = await handler(req, sampleUser, mockDb);

    expect(response.status).toBe(200);
    expect(weighmentsQuery.or).toHaveBeenCalledWith(
      "in_entry_id.in.(101,102),out_entry_id.in.(101,102)",
    );
  });

  it("sorts by in_entry.vehicle_number when sort_column is vehicle_number", async () => {
    const weighmentsQuery = createMockQueryBuilder({ data: [], count: 0 });
    const mockDb = createMockSupabase({ weighments: weighmentsQuery });

    const req = new NextRequest(
      "http://localhost/api/weighments?sort_column=vehicle_number&sort_desc=false",
    );
    const handler = GET as unknown as RawHandler;
    const response = await handler(req, sampleUser, mockDb);

    expect(response.status).toBe(200);
    expect(weighmentsQuery.order).toHaveBeenCalledWith("in_entry.vehicle_number", {
      ascending: true,
    });
  });
});

describe("DELETE /api/weighments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
  });

  it("rejects when user lacks DELETE permission", async () => {
    mockHasPermission.mockReturnValue(false);
    const req = new NextRequest("http://localhost/api/weighments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [10, 20] }),
    });

    const handler = DELETE as unknown as RawHandler;
    const response = await handler(req, sampleUser, {});

    expect(response.status).toBe(403);
    expect(mockHasPermission).toHaveBeenCalledWith(
      sampleUser,
      ProjectSlug.WEIGHMENTS,
      PermissionKey.DELETE,
    );
  });

  it("rejects invalid ids body payload", async () => {
    const req = new NextRequest("http://localhost/api/weighments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });

    const handler = DELETE as unknown as RawHandler;
    const response = await handler(req, sampleUser, {});

    expect(response.status).toBe(400);
  });

  it("returns 404 when no weighments found", async () => {
    const mockDb = createMockSupabase({
      weighments: createMockQueryBuilder({ data: [] }),
    });

    const req = new NextRequest("http://localhost/api/weighments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [100] }),
    });

    const handler = DELETE as unknown as RawHandler;
    const response = await handler(req, sampleUser, mockDb);

    expect(response.status).toBe(404);
  });

  it("successfully soft deletes weighments and returns count", async () => {
    const weighmentsQuery = createMockQueryBuilder({
      data: [
        { id: 10, in_entry_id: 1, out_entry_id: 2, in_entry: { centers: { factory_id: 1 } } },
        { id: 20, in_entry_id: 3, out_entry_id: 4, in_entry: { centers: { factory_id: 1 } } },
      ],
    });
    const entriesQuery = createMockQueryBuilder();

    const mockDb = createMockSupabase({
      weighments: weighmentsQuery,
      entries: entriesQuery,
    });

    const req = new NextRequest("http://localhost/api/weighments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [10, 20] }),
    });

    const handler = DELETE as unknown as RawHandler;
    const response = await handler(req, sampleUser, mockDb);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.deleted_count).toBe(2);
  });
});
