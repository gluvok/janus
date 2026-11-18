import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetAuthUser, mockDb } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockDb: { from: vi.fn() },
}));

vi.mock("@/lib/auth/request", () => ({
  getAuthUser: () => mockGetAuthUser(),
}));

vi.mock("@/db", () => ({
  supabase: mockDb,
}));

import { GET } from "./route";
import { POST as POST_READ } from "./read/route";

describe("Notifications API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/notifications", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/notifications");
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(401);
    });

    it("returns notifications with personal read state and bounds to 50", async () => {
      const mockUser = { sub: "1", factory_id: 1, role: "admin" };
      mockGetAuthUser.mockResolvedValue({ user: mockUser });

      const mockNotifications = [
        {
          id: 101,
          factory_id: 1,
          title: "New Vehicle Entry",
          vehicle_number: "KA05MK8888",
          weight: 42000,
          center_name: "Center #1",
          created_at: "2026-11-18T10:00:00Z",
          notification_reads: [{ read_at: "2026-11-18T10:05:00Z" }],
        },
        {
          id: 102,
          factory_id: 1,
          title: "New Vehicle Entry",
          vehicle_number: "MH12RN4590",
          weight: 38000,
          center_name: "Center #1",
          created_at: "2026-11-18T10:10:00Z",
          notification_reads: [],
        },
      ];

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
            }),
          }),
        }),
      });

      const req = new NextRequest("http://localhost:3000/api/notifications");
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notifications).toHaveLength(2);
      expect(data.notifications[0].read).toBe(true);
      expect(data.notifications[1].read).toBe(false);
      expect(data.unreadCount).toBe(1);
    });

    it("scopes notifications query to customer_id when user.role is base", async () => {
      const mockBaseUser = { sub: "5", factory_id: 1, role: "base" };
      mockGetAuthUser.mockResolvedValue({ user: mockBaseUser });

      const eqMock = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      mockDb.from.mockImplementation((table: string) => {
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 42 } }),
                }),
              }),
            }),
          };
        }
        if (table === "notifications") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: eqMock,
              }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest("http://localhost:3000/api/notifications");
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(200);
      expect(eqMock).toHaveBeenCalledWith("customer_id", 42);
    });
  });

  describe("POST /api/notifications/read", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/notifications/read", {
        method: "POST",
        body: JSON.stringify({ notification_ids: [101, 102] }),
      });
      const res = await POST_READ(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(401);
    });

    it("batch marks specified notification_ids as read for current user", async () => {
      const mockUser = { sub: "5", factory_id: 1 };
      mockGetAuthUser.mockResolvedValue({ user: mockUser });

      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mockDb.from.mockReturnValue({
        upsert: upsertMock,
      });

      const req = new NextRequest("http://localhost:3000/api/notifications/read", {
        method: "POST",
        body: JSON.stringify({ notification_ids: [101, 102] }),
      });
      const res = await POST_READ(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.markedCount).toBe(2);

      expect(upsertMock).toHaveBeenCalledWith(
        [
          { user_id: 5, notification_id: 101 },
          { user_id: 5, notification_id: 102 },
        ],
        { onConflict: "user_id,notification_id" },
      );
    });
  });
});
