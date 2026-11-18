import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  signWebhookPayload,
  verifyWebhookSignature,
  dispatchWebhook,
  sweepPendingWebhooks,
  isValidWebhookUrl,
} from "./webhooks";

describe("Decoupled & Replay-Protected Webhook Dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates timestamped HMAC-SHA256 signature in format t={timestamp},v1={hash}", () => {
    const payload = JSON.stringify({ event: "entry.created", vehicle_number: "KA05MK8888" });
    const secret = "test-secret-key";
    const timestamp = 1731934200;
    const header = signWebhookPayload(payload, secret, timestamp);

    expect(header).toMatch(/^t=1731934200,v1=[a-f0-9]{64}$/);
  });

  it("verifies signature and rejects payloads older than 5 minutes", () => {
    const payload = JSON.stringify({ event: "entry.created" });
    const secret = "test-secret-key";
    const freshTimestamp = Math.floor(Date.now() / 1000) - 30; // 30s ago
    const staleTimestamp = Math.floor(Date.now() / 1000) - 360; // 6 mins ago

    const validHeader = signWebhookPayload(payload, secret, freshTimestamp);
    const staleHeader = signWebhookPayload(payload, secret, staleTimestamp);

    expect(verifyWebhookSignature(payload, validHeader, secret)).toBe(true);
    expect(verifyWebhookSignature(payload, staleHeader, secret)).toBe(false);
  });

  it("dispatches HTTP POST with single canonical X-Gluvok-Signature header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("OK"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const logUpdateMock = vi.fn().mockResolvedValue({ error: null });
    const dbMock: any = {
      from: vi.fn((table: string) => {
        if (table === "factories") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { webhook_url: "https://client.api/webhook", webhook_secret: "secret-abc" },
                }),
              }),
            }),
          };
        }
        if (table === "webhook_logs") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 1, attempt_count: 0 } }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: logUpdateMock,
            }),
          };
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

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://client.api/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Gluvok-Event": "entry.created",
          "X-Gluvok-Signature": expect.stringMatching(/^t=\d+,v1=[a-f0-9]{64}$/),
        }),
      }),
    );
    // Confirm no redundant X-Gluvok-Timestamp header was sent
    const callHeaders = fetchMock.mock.calls[0][1].headers;
    expect(callHeaders["X-Gluvok-Timestamp"]).toBeUndefined();
  });

  it("blocks SSRF attempts targeting cloud metadata endpoints", async () => {
    const dbMock: any = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { webhook_url: "http://169.254.169.254/latest/meta-data/", webhook_secret: "sec" },
            }),
          }),
        }),
      })),
    };

    const result = await dispatchWebhook({
      factoryId: 1,
      event: "entry.created",
      payload: {},
      client: dbMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("forbidden");
  });

  it("validates webhook URLs comprehensively against SSRF evasions", () => {
    expect(isValidWebhookUrl("https://valid.example.com/webhook")).toBe(true);
    expect(isValidWebhookUrl("http://valid.example.com:8080/webhook")).toBe(true);
    
    // SSRF vectors
    expect(isValidWebhookUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isValidWebhookUrl("http://169.254.1.2/secret")).toBe(false);
    expect(isValidWebhookUrl("http://metadata.google.internal/computeMetadata")).toBe(false);
    expect(isValidWebhookUrl("http://foo.metadata.google.internal/")).toBe(false);
    expect(isValidWebhookUrl("http://100.100.100.200/latest")).toBe(false);
    expect(isValidWebhookUrl("http://[fd00:ec2::254]/")).toBe(false);
    expect(isValidWebhookUrl("http://user:pass@example.com/webhook")).toBe(false);
    expect(isValidWebhookUrl("http://example.com:6379/redis")).toBe(false);
    expect(isValidWebhookUrl("http://example.com:5432/postgres")).toBe(false);
    expect(isValidWebhookUrl("ftp://example.com/webhook")).toBe(false);
    expect(isValidWebhookUrl("invalid-url")).toBe(false);
  });

  it("schedules exponential backoff retry when destination times out", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Timeout aborted"));
    vi.stubGlobal("fetch", fetchMock);

    let updatedFields: any = null;
    const dbMock: any = {
      from: vi.fn((_table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { webhook_url: "https://slow.api/webhook", webhook_secret: "secret" },
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 2, attempt_count: 0 } }),
          }),
        }),
        update: vi.fn((fields: any) => {
          updatedFields = fields;
          return { eq: vi.fn().mockResolvedValue({ error: null }) };
        }),
      })),
    };

    const result = await dispatchWebhook({
      factoryId: 1,
      event: "entry.created",
      payload: { test: true },
      client: dbMock,
    });

    expect(result.success).toBe(false);
    expect(updatedFields.status).toBe("retrying");
    expect(updatedFields.attempt_count).toBe(1);
    expect(new Date(updatedFields.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("sweeps pending and retrying webhooks claiming overdue rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("OK"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const overdueLogs = [
      {
        id: 10,
        factory_id: 1,
        event: "entry.created",
        payload: { vehicle_number: "KA05MK8888" },
        attempt_count: 1,
        factories: { webhook_url: "https://client.api/webhook", webhook_secret: "secret" },
      },
    ];

    const dbMock: any = {
      from: vi.fn((table: string) => {
        if (table === "webhook_logs") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: overdueLogs, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      }),
    };

    const sweptCount = await sweepPendingWebhooks(dbMock);
    expect(sweptCount).toBe(1);
  });
});
