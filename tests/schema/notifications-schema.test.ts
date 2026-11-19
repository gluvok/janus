import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Hardened Production Notifications and Webhook Schema", () => {
  const schemaSql = readFileSync(resolve(__dirname, "../../schema.sql"), "utf-8");

  it("defines webhook_url and webhook_secret on factories table", () => {
    expect(schemaSql).toMatch(/webhook_url\s+TEXT/i);
    expect(schemaSql).toMatch(/webhook_secret\s+TEXT/i);
  });

  it("defines notifications table with composite index on (factory_id, id DESC)", () => {
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS notifications");
    expect(schemaSql).toMatch(/factory_id\s+INT\s+NOT\s+NULL\s+REFERENCES\s+factories/i);
    expect(schemaSql).toContain("idx_notifications_factory_id");
  });

  it("defines notification_reads join table for per-user read tracking", () => {
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS notification_reads");
    expect(schemaSql).toMatch(/user_id\s+INT\s+NOT\s+NULL\s+REFERENCES\s+users/i);
    expect(schemaSql).toMatch(
      /notification_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+notifications/i,
    );
    expect(schemaSql).toContain("PRIMARY KEY (user_id, notification_id)");
  });

  it("defines webhook_logs table with attempt_count and next_attempt_at for retry sweeping", () => {
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS webhook_logs");
    expect(schemaSql).toMatch(/attempt_count\s+INT\s+NOT\s+NULL\s+DEFAULT\s+0/i);
    expect(schemaSql).toMatch(/next_attempt_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
    expect(schemaSql).toContain("idx_webhook_logs_retry");
  });

  it("defines zero-join RLS policy checking auth.jwt() app_metadata factory_id with fail-closed default", () => {
    expect(schemaSql).toContain("factory_tenant_isolation");
    expect(schemaSql).toMatch(
      /factory_id\s*=\s*\(\(auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'factory_id'\)::int\)/i,
    );
    expect(schemaSql).toMatch(/ELSE\s+false/i);
  });
});
