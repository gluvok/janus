import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFrom = vi.fn();

vi.mock("@/db", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

import { GET } from "./route";

describe("GET /api/data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 Unauthorized when x-api-key header is missing", async () => {
    const req = new NextRequest("http://localhost/api/data");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Missing x-api-key header");
  });

  it("returns 401 Unauthorized when x-api-key header is whitespace only", async () => {
    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "   " },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Missing x-api-key header");
  });

  it("returns 500 when factory lookup fails with database error", async () => {
    const factoryQuery: Record<string, unknown> = {};
    factoryQuery.select = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.eq = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.is = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database connection failed" },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "factories") return factoryQuery;
      return {};
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "test_key_123" },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Database error during authentication");
  });

  it("returns 401 Unauthorized when no active factory matches the API key", async () => {
    const factoryQuery: Record<string, unknown> = {};
    factoryQuery.select = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.eq = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.is = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "factories") return factoryQuery;
      return {};
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "non_existent_key" },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid API key");
  });

  it("returns 200 with formatted weighments and linked entries when no IDs are processed", async () => {
    const factoryQuery: Record<string, unknown> = {};
    factoryQuery.select = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.eq = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.is = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 7, name: "Sunrise Sugar Mills" },
      error: null,
    });

    const processedQuery: Record<string, unknown> = {};
    processedQuery.select = vi.fn().mockReturnValue(processedQuery);
    processedQuery.eq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const mockWeighmentRows = [
      {
        id: 101,
        unit: "kg",
        type: "unassigned",
        rate_id: null,
        in_entry_id: 11,
        out_entry_id: 12,
        created_at: "2026-10-26T10:00:00.000Z",
        updated_at: "2026-10-26T11:00:00.000Z",
        in_entry: {
          id: 11,
          vehicle_number: "KA-01-AB-1234",
          detected_vehicle_number: "KA-01-AB-1234",
          weight: 15000,
          status: "approved",
          auto_approved: true,
          center_id: 1,
          created_by: 2,
          approved_by: 2,
          customer_id: 3,
          images: ["in_cam1.jpg"],
          created_at: "2026-10-26T09:30:00.000Z",
          updated_at: "2026-10-26T09:35:00.000Z",
          centers: { name: "Weighbridge North", factory_id: 7 },
          users: { name: "Operator One" },
          customers: { name: "Farmer Bob" },
        },
        out_entry: {
          id: 12,
          vehicle_number: "KA-01-AB-1234",
          detected_vehicle_number: null,
          weight: 5000,
          status: "approved",
          auto_approved: false,
          center_id: 1,
          created_by: 2,
          approved_by: 2,
          customer_id: 3,
          images: ["out_cam1.jpg"],
          created_at: "2026-10-26T10:45:00.000Z",
          updated_at: "2026-10-26T10:50:00.000Z",
          centers: { name: "Weighbridge North" },
          users: { name: "Operator One" },
          customers: { name: "Farmer Bob" },
        },
      },
    ];

    const weighmentsQuery: Record<string, unknown> = {};
    weighmentsQuery.select = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.eq = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.is = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.not = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.order = vi.fn().mockResolvedValue({
      data: mockWeighmentRows,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "factories") return factoryQuery;
      if (table === "factory_processed_weighments") return processedQuery;
      if (table === "weighments") return weighmentsQuery;
      return {};
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "valid_live_key_999" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.factory).toBeUndefined();
    expect(json.count).toBe(1);
    expect(json.data).toHaveLength(1);
    expect(weighmentsQuery.not).not.toHaveBeenCalled();

    const item = json.data[0];
    expect(item).toEqual({
      id: 101,
      vehicle_number: "KA-01-AB-1234",
      gross_weight: 15000,
      tare_weight: 5000,
      net_weight: 10000,
      in_entry_id: 11,
      in_entry_time: "2026-10-26T09:30:00.000Z",
      out_entry_id: 12,
      out_entry_time: "2026-10-26T10:45:00.000Z",
      in_center_id: 1,
      in_center_name: "Weighbridge North",
      out_center_id: 1,
      out_center_name: "Weighbridge North",
    });
    expect(item.unit).toBeUndefined();
    expect(item.created_at).toBeUndefined();
    expect(item.updated_at).toBeUndefined();
    expect(item.in_weight).toBeUndefined();
    expect(item.out_weight).toBeUndefined();
    expect(item.in_entry).toBeUndefined();
    expect(item.out_entry).toBeUndefined();
  });

  it("records x-processed-id in database and excludes it from results", async () => {
    const factoryQuery: Record<string, unknown> = {};
    factoryQuery.select = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.eq = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.is = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 7, name: "Sunrise Sugar Mills" },
      error: null,
    });

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const processedQuery: Record<string, unknown> = {
      upsert: mockUpsert,
    };
    processedQuery.select = vi.fn().mockReturnValue(processedQuery);
    processedQuery.eq = vi.fn().mockResolvedValue({
      data: [{ weighment_id: 10 }],
      error: null,
    });

    const weighmentsQuery: Record<string, unknown> = {};
    weighmentsQuery.select = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.eq = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.is = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.not = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "factories") return factoryQuery;
      if (table === "factory_processed_weighments") return processedQuery;
      if (table === "weighments") return weighmentsQuery;
      return {};
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: {
        "x-api-key": "valid_key",
        "x-processed-id": "10",
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      { factory_id: 7, weighment_id: 10 },
      { onConflict: "factory_id,weighment_id", ignoreDuplicates: true },
    );
    expect(weighmentsQuery.not).toHaveBeenCalledWith("id", "in", "(10)");
  });

  it("excludes multiple accumulated processed IDs", async () => {
    const factoryQuery: Record<string, unknown> = {};
    factoryQuery.select = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.eq = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.is = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 7, name: "Sunrise Sugar Mills" },
      error: null,
    });

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const processedQuery: Record<string, unknown> = {
      upsert: mockUpsert,
    };
    processedQuery.select = vi.fn().mockReturnValue(processedQuery);
    processedQuery.eq = vi.fn().mockResolvedValue({
      data: [{ weighment_id: 10 }, { weighment_id: 8 }],
      error: null,
    });

    const weighmentsQuery: Record<string, unknown> = {};
    weighmentsQuery.select = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.eq = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.is = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.not = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "factories") return factoryQuery;
      if (table === "factory_processed_weighments") return processedQuery;
      if (table === "weighments") return weighmentsQuery;
      return {};
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: {
        "x-api-key": "valid_key",
        "x-processed-id": "8",
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      { factory_id: 7, weighment_id: 8 },
      { onConflict: "factory_id,weighment_id", ignoreDuplicates: true },
    );
    expect(weighmentsQuery.not).toHaveBeenCalledWith("id", "in", "(10,8)");
  });

  it("handles invalid or non-numeric x-processed-id gracefully without failing", async () => {
    const factoryQuery: Record<string, unknown> = {};
    factoryQuery.select = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.eq = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.is = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 7, name: "Sunrise Sugar Mills" },
      error: null,
    });

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const processedQuery: Record<string, unknown> = {
      upsert: mockUpsert,
    };
    processedQuery.select = vi.fn().mockReturnValue(processedQuery);
    processedQuery.eq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const weighmentsQuery: Record<string, unknown> = {};
    weighmentsQuery.select = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.eq = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.is = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.not = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "factories") return factoryQuery;
      if (table === "factory_processed_weighments") return processedQuery;
      if (table === "weighments") return weighmentsQuery;
      return {};
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: {
        "x-api-key": "valid_key",
        "x-processed-id": "not-a-number",
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(weighmentsQuery.not).not.toHaveBeenCalled();
  });

  it("returns 500 when weighments query encounters a database error", async () => {
    const factoryQuery: Record<string, unknown> = {};
    factoryQuery.select = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.eq = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.is = vi.fn().mockReturnValue(factoryQuery);
    factoryQuery.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 7, name: "Sunrise Sugar Mills" },
      error: null,
    });

    const processedQuery: Record<string, unknown> = {};
    processedQuery.select = vi.fn().mockReturnValue(processedQuery);
    processedQuery.eq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const weighmentsQuery: Record<string, unknown> = {};
    weighmentsQuery.select = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.eq = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.is = vi.fn().mockReturnValue(weighmentsQuery);
    weighmentsQuery.order = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Query timeout" },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "factories") return factoryQuery;
      if (table === "factory_processed_weighments") return processedQuery;
      if (table === "weighments") return weighmentsQuery;
      return {};
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "valid_key" },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to retrieve weighment data");
  });
});
