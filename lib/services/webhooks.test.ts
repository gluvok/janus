import { describe, it, expect, vi, beforeEach } from "vitest";
import { signWebhookPayload, dispatchWebhook } from "./webhooks";

describe("Webhook Dispatcher Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("generates correct HMAC-SHA256 signature for payload", () => {
    const payload = JSON.stringify({ event: "entry.created", id: 101 });
    const secret = "test-secret-key";
    const signature = signWebhookPayload(payload, secret);

    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("returns null early if factory has no webhook_url configured", async () => {
    const dbMock: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { webhook_url: null, webhook_secret: null } }),
          }),
        }),
      }),
    };

    const result = await dispatchWebhook({
      factoryId: 1,
      event: "entry.created",
      payload: { vehicle_number: "KA05MK8888" },
      client: dbMock,
    });

    expect(result).toBeNull();
  });

  it("sends HTTP POST with signature header when webhook_url is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("OK"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const logInsertMock = vi.fn().mockResolvedValue({ error: null });
    const dbMock: any = {
      from: vi.fn((table: string) => {
        if (table === "factories") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    webhook_url: "https://example.com/webhook",
                    webhook_secret: "secret-123",
                  },
                }),
              }),
            }),
          };
        }
        if (table === "webhook_logs") {
          return { insert: logInsertMock };
        }
        return {};
      }),
    };

    const result = await dispatchWebhook({
      factoryId: 1,
      event: "entry.created",
      payload: { vehicle_number: "KA05MK8888", weight: 35000 },
      client: dbMock,
    });

    expect(result?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Gluvok-Event": "entry.created",
          "X-Gluvok-Signature": expect.stringMatching(/^sha256=/),
        }),
      }),
    );
    expect(logInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        factory_id: 1,
        event: "entry.created",
        status: "delivered",
        response_status: 200,
        attempts: 1,
      }),
    );
  });

  it("catches network failure and logs failure to webhook_logs", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", fetchMock);

    const logInsertMock = vi.fn().mockResolvedValue({ error: null });
    const dbMock: any = {
      from: vi.fn((table: string) => {
        if (table === "factories") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    webhook_url: "https://example.com/down",
                    webhook_secret: "secret-123",
                  },
                }),
              }),
            }),
          };
        }
        if (table === "webhook_logs") {
          return { insert: logInsertMock };
        }
        return {};
      }),
    };

    const result = await dispatchWebhook({
      factoryId: 1,
      event: "entry.created",
      payload: { vehicle_number: "KA05MK8888" },
      client: dbMock,
    });

    expect(result?.success).toBe(false);
    expect(result?.error).toContain("Connection refused");
    expect(logInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        factory_id: 1,
        event: "entry.created",
        status: "failed",
        attempts: 1,
        last_error: "Connection refused",
      }),
    );
  });
});
