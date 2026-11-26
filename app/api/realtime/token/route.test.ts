import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { Role } from "@/lib/constants/enums";
import { createMockUser } from "@/tests/test-utils";

const { mockHasPermission } = vi.hoisted(() => ({ mockHasPermission: vi.fn() }));

vi.mock("@/db/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/helpers")>();
  return { ...actual, withAuth: <T>(h: T) => h, hasPermission: mockHasPermission };
});

import { GET } from "./route";

const SECRET = "test-secret-at-least-32-characters-long!!";
type RawHandler = (req: NextRequest, user: unknown) => Promise<Response>;
const handler = GET as unknown as RawHandler;
const req = () => new NextRequest("http://localhost/api/realtime/token");
const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());

describe("GET /api/realtime/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
    vi.stubEnv("SUPABASE_JWT_SECRET", SECRET);
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
  });

  it("signs an HS256 token the secret verifies, scoped to the user's factory", async () => {
    const res = await handler(
      req(),
      createMockUser({ sub: "5", factory_id: 7, role: Role.OPERATOR }),
    );
    const body = await res.json();
    const [h, p, s] = body.token.split(".");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(decode(h)).toEqual({ alg: "HS256", typ: "JWT" });
    expect(s).toBe(createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url"));
    const claims = decode(p);
    expect(claims).toMatchObject({
      role: "authenticated",
      aud: "authenticated",
      sub: "5",
      app_role: Role.OPERATOR,
      factory_id: 7,
    });
    expect(claims.exp - claims.iat).toBe(3600);
    expect(body).toMatchObject({
      url: "http://127.0.0.1:54321",
      anonKey: "anon-key",
      topic: "factory:7",
    });
    expect(body.expiresAt).toBe(claims.exp * 1000);
  });

  it("gives BASE users their own user topic, not the factory topic", async () => {
    const body = await (
      await handler(req(), createMockUser({ sub: "42", role: Role.BASE }))
    ).json();
    expect(body.topic).toBe("user:42");
  });

  it("returns 403 for roles that can read neither entries nor weighments", async () => {
    mockHasPermission.mockReturnValue(false);
    expect((await handler(req(), createMockUser({ role: Role.HARDWARE }))).status).toBe(403);
  });

  it("returns 403 instead of minting a factory:null topic when a staff user has no factory", async () => {
    const user = { ...createMockUser({ role: Role.OPERATOR }), factory_id: null };
    expect((await handler(req(), user)).status).toBe(403);
  });

  it("returns 500 and never leaks config when the secret is missing", async () => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "");
    const res = await handler(req(), createMockUser());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/anon-key|SUPABASE/);
  });

  it("never returns the server's service key", async () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "service-role-key");
    const text = await (await handler(req(), createMockUser())).text();
    expect(text).not.toContain("service-role-key");
  });
});
