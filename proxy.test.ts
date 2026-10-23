import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { Role } from "@/lib/constants/enums";
import { validateSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({
  validateSession: vi.fn(),
}));

describe("Next.js Middleware Proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through public route /login", async () => {
    const req = new NextRequest("http://localhost/login");
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through static and internal next assets", async () => {
    const req = new NextRequest("http://localhost/_next/static/chunk.js");
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it("passes through public health check route /api/health without authentication", async () => {
    const req = new NextRequest("http://localhost/api/health");
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through public data route /api/data without session token", async () => {
    const req = new NextRequest("http://localhost/api/data");
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows access with valid session token in cookie and sets header attributes", async () => {
    vi.mocked(validateSession).mockResolvedValue({
      sub: "123",
      username: "admin_user",
      name: "Admin User",
      role: Role.ADMIN,
      factory_id: 5,
    });

    const req = new NextRequest("http://localhost/projects/centers");
    req.cookies.set("session_token", "valid-session-token");

    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows access with valid Bearer session token and sets header attributes", async () => {
    vi.mocked(validateSession).mockResolvedValue({
      sub: "123",
      username: "admin_user",
      name: "Admin User",
      role: Role.ADMIN,
      factory_id: 5,
    });

    const req = new NextRequest("http://localhost/api/centers", {
      headers: {
        Authorization: "Bearer valid-bearer-session",
      },
    });

    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects to /login on page requests when session is invalid or missing", async () => {
    vi.mocked(validateSession).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/projects/centers");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("returns 401 on API requests when session is invalid or missing", async () => {
    vi.mocked(validateSession).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/centers");
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  it("passes through POST /api/entries with Basic Auth without session token", async () => {
    const req = new NextRequest("http://localhost/api/entries", {
      method: "POST",
      headers: {
        Authorization: "Basic cGkxOmhhcmR3YXJlMTIz",
        "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundary",
      },
    });

    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through POST /api/entries with multipart/form-data without session token", async () => {
    const req = new NextRequest("http://localhost/api/entries", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundary",
      },
    });

    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
