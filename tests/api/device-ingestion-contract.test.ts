import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { StatusCodes } from "http-status-codes";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    from: vi.fn(),
  },
}));

vi.mock("@/db", () => ({
  supabase: mockDb,
}));

import { hasDeviceCredentials, verifyDeviceRequest } from "@/lib/auth/device";

describe("Hermes -> Janus Device Ingestion Security Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accurately detects HTTP Basic Auth credentials from Hermes", () => {
    const basicAuth = `Basic ${Buffer.from("pi1:hardware123").toString("base64")}`;
    const req = new NextRequest("http://localhost:3000/api/entries", {
      headers: { authorization: basicAuth },
    });

    expect(hasDeviceCredentials(req)).toBe(true);
  });

  it("rejects invalid device credentials with 403 Forbidden", async () => {
    mockDb.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    const badAuth = `Basic ${Buffer.from("invalid_device:wrong_key").toString("base64")}`;
    const req = new NextRequest("http://localhost:3000/api/entries", {
      headers: { authorization: badAuth },
    });

    const authResult = await verifyDeviceRequest(req, mockDb as any);
    expect(authResult.success).toBe(false);
    expect(authResult.status).toBe(StatusCodes.FORBIDDEN);
    expect(authResult.error).toBe("Unauthorized or disabled device");
  });

  it("rejects unauthenticated requests lacking credentials", () => {
    const req = new NextRequest("http://localhost:3000/api/entries");
    expect(hasDeviceCredentials(req)).toBe(false);
  });
});
