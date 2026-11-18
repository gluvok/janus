import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Factory Webhook Schema Definition", () => {
  it("defines webhook_url and webhook_secret columns on factories table in schema.sql", () => {
    const schemaSql = readFileSync(resolve(process.cwd(), "schema.sql"), "utf-8");
    expect(schemaSql).toMatch(/webhook_url\s+TEXT/i);
    expect(schemaSql).toMatch(/webhook_secret\s+TEXT/i);
  });
});
