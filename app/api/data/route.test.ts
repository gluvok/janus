import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { db } from "@/db";
import { Unit, WeighmentType } from "@/lib/constants/enums";

vi.mock("@/db", () => ({
  db: {
    from: vi.fn(),
  },
}));

describe("GET /api/data", () => {
  const originalEnv = process.env;
  const TEST_API_KEY = "test-secret-api-key-12345";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, DATA_API_KEY: TEST_API_KEY };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects request with 401 when X-API-KEY header is missing", async () => {
    const req = new NextRequest("http://localhost/api/data");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("rejects request with 401 when X-API-KEY header is incorrect", async () => {
    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "invalid-key" },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("rejects request with 401 when environment API key is not configured", async () => {
    delete process.env.DATA_API_KEY;
    delete process.env.API_KEY;

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": TEST_API_KEY },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("accepts request with fallback API_KEY environment variable", async () => {
    delete process.env.DATA_API_KEY;
    process.env.API_KEY = "fallback-secret-key";

    const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ is: mockIs });
    vi.mocked(db.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<
      typeof db.from
    >);

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "fallback-secret-key" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, total: 0, data: [] });
  });

  it("returns empty weighment list when no records exist", async () => {
    const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ is: mockIs });
    vi.mocked(db.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<
      typeof db.from
    >);

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": TEST_API_KEY },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      total: 0,
      data: [],
    });
  });

  it("returns formatted weighment records with enriched linked entries", async () => {
    const mockWeighmentRow = {
      id: 42,
      unit: Unit.KG,
      type: WeighmentType.UNASSIGNED,
      rate_id: 7,
      in_entry_id: 101,
      out_entry_id: 102,
      created_at: "2026-10-20T01:00:00Z",
      updated_at: "2026-10-20T01:30:00Z",
      deleted_at: null,
    };

    const mockEntries = [
      {
        id: 101,
        weight: 15000,
        vehicle_number: "KA01AB1234",
        created_at: "2026-10-20T01:00:00Z",
        center_id: 1,
        created_by: 2,
        customer_id: 3,
        images: ["img1.jpg"],
      },
      {
        id: 102,
        weight: 5000,
        vehicle_number: "KA01AB1234",
        created_at: "2026-10-20T01:30:00Z",
        center_id: 1,
        created_by: 2,
        customer_id: 3,
        images: ["img2.jpg"],
      },
    ];

    vi.mocked(db.from).mockImplementation((table: string) => {
      if (table === "automatic_weighments") {
        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [mockWeighmentRow],
                  error: null,
                }),
              }),
            }),
          }),
        } as unknown as ReturnType<typeof db.from>;
      }
      if (table === "automatic_entries") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockEntries,
              error: null,
            }),
          }),
        } as unknown as ReturnType<typeof db.from>;
      }
      if (table === "centers") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 1, name: "Center Alpha" }],
              error: null,
            }),
          }),
        } as unknown as ReturnType<typeof db.from>;
      }
      if (table === "customers") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 3, name: "Farmer 1" }],
              error: null,
            }),
          }),
        } as unknown as ReturnType<typeof db.from>;
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 2, name: "Operator Alpha" }],
              error: null,
            }),
          }),
        } as unknown as ReturnType<typeof db.from>;
      }
      return {} as unknown as ReturnType<typeof db.from>;
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": TEST_API_KEY },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(db.from).toHaveBeenCalledWith("automatic_weighments");
    expect(db.from).toHaveBeenCalledWith("automatic_entries");
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.data).toHaveLength(1);

    const record = body.data[0];
    expect(record.id).toBe(42);
    expect(record.gross_weight).toBe(15000);
    expect(record.tare_weight).toBe(5000);
    expect(record.net_weight).toBe(10000);
    expect(record.vehicle_number).toBe("KA01AB1234");
    expect(record.in_center_name).toBe("Center Alpha");
    expect(record.in_customer_name).toBe("Farmer 1");
    expect(record.in_user_name).toBe("Operator Alpha");
    expect(record.images).toEqual(["img1.jpg", "img2.jpg"]);
  });

  it("handles multi-batch pagination from database and combines into one response", async () => {
    const batch1 = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      unit: Unit.KG,
      type: WeighmentType.UNASSIGNED,
      rate_id: null,
      in_entry_id: (i + 1) * 2,
      out_entry_id: (i + 1) * 2 + 1,
      created_at: "2026-10-20T00:00:00Z",
      updated_at: "2026-10-20T00:00:00Z",
      deleted_at: null,
    }));

    const batch2 = Array.from({ length: 250 }, (_, i) => ({
      id: 1000 + i + 1,
      unit: Unit.KG,
      type: WeighmentType.UNASSIGNED,
      rate_id: null,
      in_entry_id: (1000 + i + 1) * 2,
      out_entry_id: (1000 + i + 1) * 2 + 1,
      created_at: "2026-10-20T00:00:00Z",
      updated_at: "2026-10-20T00:00:00Z",
      deleted_at: null,
    }));

    const mockRange = vi
      .fn()
      .mockResolvedValueOnce({ data: batch1, error: null })
      .mockResolvedValueOnce({ data: batch2, error: null });

    vi.mocked(db.from).mockImplementation((table: string) => {
      if (table === "automatic_weighments") {
        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: mockRange,
              }),
            }),
          }),
        } as unknown as ReturnType<typeof db.from>;
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof db.from>;
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": TEST_API_KEY },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.total).toBe(1250);
    expect(body.data).toHaveLength(1250);
    expect(mockRange).toHaveBeenCalledTimes(2);
    expect(mockRange).toHaveBeenNthCalledWith(1, 0, 999);
    expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("returns 500 when database returns a query error on automatic_weighments", async () => {
    const mockRange = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database connection terminated unexpectedly" },
    });

    vi.mocked(db.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: mockRange,
          }),
        }),
      }),
    } as unknown as ReturnType<typeof db.from>);

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": TEST_API_KEY },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Database connection terminated unexpectedly" });
  });

  it("returns 500 when database query throws unexpected exception", async () => {
    const mockRange = vi.fn().mockRejectedValue(new Error("Network timeout"));

    vi.mocked(db.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: mockRange,
          }),
        }),
      }),
    } as unknown as ReturnType<typeof db.from>);

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": TEST_API_KEY },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Network timeout" });
  });
});
