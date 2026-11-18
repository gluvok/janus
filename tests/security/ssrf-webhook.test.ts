import { describe, it, expect } from "vitest";
import { isPrivateOrInternalUrl, isValidWebhookUrl } from "@/lib/services/webhooks";

describe("Webhook SSRF Protection Engine", () => {
  it("blocks private loopback and link-local metadata IP addresses", () => {
    expect(isPrivateOrInternalUrl("http://127.0.0.1:8000/webhook")).toBe(true);
    expect(isPrivateOrInternalUrl("http://localhost:3000/api")).toBe(true);
    expect(isPrivateOrInternalUrl("http://169.254.169.254/latest/meta-data")).toBe(true);
    expect(isPrivateOrInternalUrl("http://10.0.0.1/erp")).toBe(true);
    expect(isPrivateOrInternalUrl("http://192.168.1.1/erp")).toBe(true);
    expect(isPrivateOrInternalUrl("http://172.16.5.10/erp")).toBe(true);
  });

  it("permits verified public HTTPS webhooks", () => {
    expect(isPrivateOrInternalUrl("https://api.factory-erp.com/gluvok/webhook")).toBe(false);
    expect(isPrivateOrInternalUrl("https://hooks.slack.com/services/T00/B00/X00")).toBe(false);
  });

  it("ensures isValidWebhookUrl rejects dangerous ports and metadata", () => {
    expect(isValidWebhookUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isValidWebhookUrl("http://api.factory-erp.com:6379/")).toBe(false);
    expect(isValidWebhookUrl("https://api.factory-erp.com/webhook")).toBe(true);
  });
});
