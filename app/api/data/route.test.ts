import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRpc = vi.fn();

vi.mock("@/db", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { GET, POST } from "./route";

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
    });
  });

  it("returns 200 with formatted weighments and linked entries", async () => {
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
    });

    const json = await res.json();
    expect(json.count).toBe(1);
    expect(json.data).toHaveLength(1);
    expect(json.acknowledged_processed_id).toBeUndefined();

    const item = json.data[0];
    expect(item).toEqual(mockWeighmentData[0]);
  });
});

describe("POST /api/data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 Unauthorized when x-api-key header is missing", async () => {
    const req = new NextRequest("http://localhost/api/data", {
      method: "POST",
      body: JSON.stringify({ weighment_id: 101 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Missing x-api-key header");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 401 Unauthorized when x-api-key header is whitespace only", async () => {
    const req = new NextRequest("http://localhost/api/data", {
      method: "POST",
      headers: { "x-api-key": "   " },
      body: JSON.stringify({ weighment_id: 101 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Missing x-api-key header");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request when JSON body is invalid", async () => {
    const req = new NextRequest("http://localhost/api/data", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: "not-json",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON body");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request when weighment_id is missing or invalid", async () => {
    const req = new NextRequest("http://localhost/api/data", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ foo: "bar" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid or missing weighment ID");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request when weighment_id is non-positive or not an integer", async () => {
    const req = new NextRequest("http://localhost/api/data", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ weighment_id: -5 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid or missing weighment ID");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 500 when RPC encounters a database error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Database failure" },
    });

    const req = new NextRequest("http://localhost/api/data", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ weighment_id: 101 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to acknowledge weighment");
    expect(mockRpc).toHaveBeenCalledWith("acknowledge_factory_weighment", {
      p_api_key: "valid_key",
      p_weighment_id: 101,
    });
  });

  it("returns 401 Unauthorized when factory API key is invalid", async () => {
    mockRpc.mockResolvedValue({
      data: { unauthorized: true },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data", {
      method: "POST",
      headers: { "x-api-key": "bad_key" },
      body: JSON.stringify({ weighment_id: 101 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid API key");
  });

  it("returns 404 Not Found when weighment does not exist or belongs to another factory", async () => {
    mockRpc.mockResolvedValue({
      data: { not_found: true },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ weighment_id: 9999 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Weighment not found");
  });

  it("returns 200 OK and confirms acknowledgment with weighment_id", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, acknowledged_id: 101 },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ weighment_id: 101 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      success: true,
      acknowledged_id: 101,
      message: "Weighment acknowledged successfully",
    });
    expect(mockRpc).toHaveBeenCalledWith("acknowledge_factory_weighment", {
      p_api_key: "valid_key",
      p_weighment_id: 101,
    });
  });

  it("supports alias { id: number } and numeric string in payload", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, acknowledged_id: 202 },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ id: "202" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.acknowledged_id).toBe(202);
    expect(mockRpc).toHaveBeenCalledWith("acknowledge_factory_weighment", {
      p_api_key: "valid_key",
      p_weighment_id: 202,
    });
  });
});
