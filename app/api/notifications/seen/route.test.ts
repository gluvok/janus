import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockQueryBuilder, createMockSupabase, createMockUser } from "@/tests/test-utils";

vi.mock("@/db/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/helpers")>();
  return { ...actual, withAuth: <T>(h: T) => h };
});

import { POST } from "./route";

type RawHandler = (req: NextRequest, user: unknown, db: unknown) => Promise<Response>;
const handler = POST as unknown as RawHandler;
const NOW = "2026-11-24T12:00:00.000Z";
const req = () => new NextRequest("http://localhost/api/notifications/seen", { method: "POST" });

describe("POST /api/notifications/seen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stamps the caller's notifications_seen_at with the server time, no body needed", async () => {
    const users = createMockQueryBuilder();
    const res = await handler(req(), createMockUser({ sub: "5" }), createMockSupabase({ users }));

    expect(res.status).toBe(200);
    expect(users.update).toHaveBeenCalledWith({ notifications_seen_at: NOW });
    expect(users.eq).toHaveBeenCalledWith("id", 5);
    expect(await res.json()).toEqual({ seenAt: NOW });
  });

  it("returns 500 when the update fails", async () => {
    const users = createMockQueryBuilder({ error: { message: "boom" } });
    const res = await handler(req(), createMockUser(), createMockSupabase({ users }));
    expect(res.status).toBe(500);
  });
});
