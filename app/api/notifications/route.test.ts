import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockSupabase, mockUser } = vi.hoisted(() => {
  return {
    mockSupabase: {
      from: vi.fn(),
    },
    mockUser: {
      current: null as any,
    },
  };
});

vi.mock("@/db/helpers", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    supabase: mockSupabase,
    withAuth: (handler: any) => async (req: any, ctx: any) => {
      if (!mockUser.current) {
        return actual.apiError("Unauthorized", 401);
      }
      return handler(req, mockUser.current, mockSupabase, ctx);
    },
  };
});

import { GET, PATCH } from "./route";

describe("Notifications API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.current = null;
  });

  it("returns 401 when request is not authenticated", async () => {
    mockUser.current = null;
    const req = new NextRequest("http://localhost:3000/api/notifications");
    const res = await GET(req, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(401);
  });

  it("returns unread notifications for authenticated user's factory", async () => {
    mockUser.current = { id: 1, factory_id: 1, role: "admin" };

    const mockData = [
      {
        id: 10,
        factory_id: 1,
        vehicle_number: "KA05MK8888",
        weight: 35000,
        title: "New Vehicle Entry",
        read: false,
        created_at: new Date().toISOString(),
      },
    ];

    const queryMock: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };

    mockSupabase.from.mockReturnValue(queryMock);

    const req = new NextRequest("http://localhost:3000/api/notifications");
    const res = await GET(req, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toEqual(mockData);
    expect(mockSupabase.from).toHaveBeenCalledWith("notifications");
    expect(queryMock.eq).toHaveBeenCalledWith("factory_id", 1);
  });

  it("marks notifications as read via PATCH", async () => {
    mockUser.current = { id: 1, factory_id: 1, role: "admin" };

    const updateMock: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabase.from.mockReturnValue(updateMock);

    const req = new NextRequest("http://localhost:3000/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [10, 11] }),
    });

    const res = await PATCH(req, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(updateMock.update).toHaveBeenCalledWith({ read: true });
    expect(updateMock.in).toHaveBeenCalledWith("id", [10, 11]);
  });
});
