import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRpc = vi.fn();

vi.mock("@/db", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
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
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 401 Unauthorized when x-api-key header is whitespace only", async () => {
    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "   " },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Missing x-api-key header");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 500 when RPC encounters a database error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Database connection failed" },
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "test_key_123" },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to retrieve weighment data");
    expect(mockRpc).toHaveBeenCalledWith("get_factory_weighment_data", {
      p_api_key: "test_key_123",
      p_processed_id: null,
    });
  });

  it("returns 401 Unauthorized when no active factory matches the API key", async () => {
    mockRpc.mockResolvedValue({
      data: { unauthorized: true },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "non_existent_key" },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid API key");
    expect(mockRpc).toHaveBeenCalledWith("get_factory_weighment_data", {
      p_api_key: "non_existent_key",
      p_processed_id: null,
    });
  });

  it("returns 200 with formatted weighments and linked entries when no IDs are processed", async () => {
    const mockWeighmentData = [
      {
        id: 101,
        vehicle_number: "KA-01-AB-1234",
        gross_weight: 15000,
        tare_weight: 5000,
        net_weight: 10000,
        images: ["in_cam1.jpg", "out_cam1.jpg"],
        in_entry_id: 11,
        in_entry_time: "2026-10-26T09:30:00.000Z",
        out_entry_id: 12,
        out_entry_time: "2026-10-26T10:45:00.000Z",
        in_center_id: 1,
        in_center_name: "Weighbridge North",
        out_center_id: 1,
        out_center_name: "Weighbridge North",
      },
    ];

    mockRpc.mockResolvedValue({
      data: {
        data: mockWeighmentData,
        count: 1,
      },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: { "x-api-key": "valid_live_key_999" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("get_factory_weighment_data", {
      p_api_key: "valid_live_key_999",
      p_processed_id: null,
    });

    const json = await res.json();
    expect(json.factory).toBeUndefined();
    expect(json.count).toBe(1);
    expect(json.data).toHaveLength(1);

    const item = json.data[0];
    expect(item).toEqual({
      id: 101,
      vehicle_number: "KA-01-AB-1234",
      gross_weight: 15000,
      tare_weight: 5000,
      net_weight: 10000,
      images: ["in_cam1.jpg", "out_cam1.jpg"],
      in_entry_id: 11,
      in_entry_time: "2026-10-26T09:30:00.000Z",
      out_entry_id: 12,
      out_entry_time: "2026-10-26T10:45:00.000Z",
      in_center_id: 1,
      in_center_name: "Weighbridge North",
      out_center_id: 1,
      out_center_name: "Weighbridge North",
    });
  });

  it("records x-processed-id in database and excludes it from results", async () => {
    mockRpc.mockResolvedValue({
      data: {
        data: [],
        count: 0,
      },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: {
        "x-api-key": "valid_key",
        "x-processed-id": "10",
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("get_factory_weighment_data", {
      p_api_key: "valid_key",
      p_processed_id: 10,
    });

    const json = await res.json();
    expect(json.data).toEqual([]);
    expect(json.count).toBe(0);
  });

  it("handles invalid or non-numeric x-processed-id gracefully without failing", async () => {
    mockRpc.mockResolvedValue({
      data: {
        data: [],
        count: 0,
      },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data", {
      headers: {
        "x-api-key": "valid_key",
        "x-processed-id": "not-a-number",
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("get_factory_weighment_data", {
      p_api_key: "valid_key",
      p_processed_id: null,
    });

    const json = await res.json();
    expect(json.data).toEqual([]);
    expect(json.count).toBe(0);
  });
});
