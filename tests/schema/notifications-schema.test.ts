import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Notifications and Webhook Schema", () => {
  const schemaSql = readFileSync(resolve(__dirname, "../../schema.sql"), "utf-8");

  it("defines webhook_url and webhook_secret on factories table", () => {
    expect(schemaSql).toMatch(/webhook_url\s+TEXT/i);
    expect(schemaSql).toMatch(/webhook_secret\s+TEXT/i);
  });

  it("defines notifications table with foreign keys and indexes", () => {
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS notifications");
    expect(schemaSql).toMatch(/factory_id\s+INT\s+NOT\s+NULL\s+REFERENCES\s+factories/i);
    expect(schemaSql).toMatch(/vehicle_number\s+TEXT\s+NOT\s+NULL/i);
    expect(schemaSql).toMatch(/read\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i);
    expect(schemaSql).toContain("idx_notifications_factory");
  });

  it("defines webhook_logs table for delivery tracking", () => {
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS webhook_logs");
    expect(schemaSql).toMatch(/status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i);
    expect(schemaSql).toMatch(/attempts\s+INT\s+NOT\s+NULL\s+DEFAULT\s+0/i);
  });

  it("publishes notifications table to supabase_realtime", () => {
    expect(schemaSql).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;");
  });
});
