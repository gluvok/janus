import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchWebhook, createWebhookSignature } from "./webhooks";

describe("Webhook Dispatcher Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("computes a valid HMAC-SHA256 signature string", () => {
    const payload = JSON.stringify({ test: "value" });
    const secret = "super-secret-key";
    const sig = createWebhookSignature(payload, secret);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it("skips dispatch if factory has no webhook_url configured", async () => {
    const mockClient: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { webhook_url: null, webhook_secret: null } }),
          }),
        }),
      }),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await dispatchWebhook(mockClient, 1, "entry.created", { id: 101 });
    expect(result.dispatched).toBe(false);
    expect(result.reason).toBe("no_webhook_url");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("dispatches POST request with correct payload and HMAC signature header", async () => {
    const mockClient: any = {
      from: vi.fn().mockReturnValue({
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
      }),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const result = await dispatchWebhook(mockClient, 1, "entry.created", {
      id: 99,
      vehicle_number: "KA05MK8888",
    });

    expect(result.dispatched).toBe(true);
    expect(result.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Gluvok-Event": "entry.created",
          "X-Gluvok-Signature": expect.any(String),
        }),
      }),
    );
  });

  it("rejects non-http/https webhook URLs safely (SSRF prevention)", async () => {
    const mockClient: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                webhook_url: "file:///etc/passwd",
                webhook_secret: "secret-123",
              },
            }),
          }),
        }),
      }),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await dispatchWebhook(mockClient, 1, "entry.created", { id: 99 });
    expect(result.dispatched).toBe(false);
    expect(result.reason).toBe("invalid_url_protocol");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("handles fetch network failure without throwing uncaught exceptions", async () => {
    const mockClient: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                webhook_url: "https://down.example.com",
                webhook_secret: null,
              },
            }),
          }),
        }),
      }),
    };

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Connection refused"));

    const result = await dispatchWebhook(mockClient, 1, "entry.created", { id: 99 });
    expect(result.dispatched).toBe(false);
    expect(result.reason).toContain("Connection refused");
  });
});
