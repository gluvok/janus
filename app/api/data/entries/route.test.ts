import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { EntryStatus } from "@/lib/constants/enums";

const mockRpc = vi.fn();

vi.mock("@/db", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { GET, POST, OPTIONS } from "./route";

describe("OPTIONS /api/data/entries", () => {
  it("returns 200 with empty json body for CORS preflight", async () => {
    const res = await OPTIONS();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({});
  });
});

describe("GET /api/data/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 Unauthorized when x-api-key header is missing", async () => {
    const req = new NextRequest("http://localhost/api/data/entries");
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

    const req = new NextRequest("http://localhost/api/data/entries", {
      headers: { "x-api-key": "test_key_123" },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to retrieve entry data");
    expect(mockRpc).toHaveBeenCalledWith("get_factory_entry_data", {
      p_api_key: "test_key_123",
    });
  });

  it("returns 401 Unauthorized when no active factory matches the API key", async () => {
    mockRpc.mockResolvedValue({
      data: { unauthorized: true },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data/entries", {
      headers: { "x-api-key": "non_existent_key" },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid API key");
    expect(mockRpc).toHaveBeenCalledWith("get_factory_entry_data", {
      p_api_key: "non_existent_key",
    });
  });

  it("returns 200 with formatted unprocessed entries", async () => {
    const mockEntryData = [
      {
        id: 501,
        vehicle_number: "KA-05-MM-9999",
        weight: 12500,
        status: EntryStatus.APPROVED,
        images: ["cam1.jpg", "cam2.jpg"],
        center_id: 2,
        created_at: "2026-11-01T12:00:00.000Z",
      },
    ];

    mockRpc.mockResolvedValue({
      data: {
        data: mockEntryData,
        count: 1,
      },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data/entries", {
      headers: { "x-api-key": "valid_live_key_entry" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("get_factory_entry_data", {
      p_api_key: "valid_live_key_entry",
    });

    const json = await res.json();
    expect(json.count).toBe(1);
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toEqual(mockEntryData[0]);
  });
});

describe("POST /api/data/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 Unauthorized when x-api-key header is missing", async () => {
    const req = new NextRequest("http://localhost/api/data/entries", {
      method: "POST",
      body: JSON.stringify({ id: 501 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Missing x-api-key header");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request when JSON body is invalid", async () => {
    const req = new NextRequest("http://localhost/api/data/entries", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: "invalid-json",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON body");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request when id is missing or invalid", async () => {
    const req = new NextRequest("http://localhost/api/data/entries", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ invalid_field: "test" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid or missing ID");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request when id is a string", async () => {
    const req = new NextRequest("http://localhost/api/data/entries", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ id: "501" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid or missing ID");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request when legacy entry_id alias is sent instead of id", async () => {
    const req = new NextRequest("http://localhost/api/data/entries", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ entry_id: 501 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid or missing ID");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 500 when RPC encounters a database error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Database failure" },
    });

    const req = new NextRequest("http://localhost/api/data/entries", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ id: 501 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to acknowledge entry");
    expect(mockRpc).toHaveBeenCalledWith("acknowledge_factory_entry", {
      p_api_key: "valid_key",
      p_entry_id: 501,
    });
  });

  it("returns 401 Unauthorized when factory API key is invalid", async () => {
    mockRpc.mockResolvedValue({
      data: { unauthorized: true },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data/entries", {
      method: "POST",
      headers: { "x-api-key": "bad_key" },
      body: JSON.stringify({ id: 501 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid API key");
  });

  it("returns 404 Not Found when entry does not exist or belongs to another factory", async () => {
    mockRpc.mockResolvedValue({
      data: { not_found: true },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data/entries", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ id: 99999 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Entry not found");
  });

  it("returns 200 OK and confirms acknowledgment with id", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, acknowledged_id: 501 },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/data/entries", {
      method: "POST",
      headers: { "x-api-key": "valid_key" },
      body: JSON.stringify({ id: 501 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      success: true,
      acknowledged_id: 501,
      message: "Entry acknowledged successfully",
    });
    expect(mockRpc).toHaveBeenCalledWith("acknowledge_factory_entry", {
      p_api_key: "valid_key",
      p_entry_id: 501,
    });
  });
});
