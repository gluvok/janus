import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Database Schema Security Hardening", () => {
  const schemaSql = fs.readFileSync(path.resolve(__dirname, "../../schema.sql"), "utf-8");

  it("ensures reset_all_sequences revokes execution from PUBLIC and anon", () => {
    expect(schemaSql).toMatch(/REVOKE ALL ON FUNCTION reset_all_sequences\(\) FROM PUBLIC, anon;/i);
  });

  it("ensures reset_table_sequence revokes execution from PUBLIC and anon", () => {
    expect(schemaSql).toMatch(/REVOKE ALL ON FUNCTION reset_table_sequence\(text\) FROM PUBLIC, anon;/i);
  });

  it("enforces SET search_path on all SECURITY DEFINER procedures", () => {
    const secDefinerMatches = schemaSql.match(/SECURITY DEFINER[\s\S]*?AS \$\$/g) || [];
    expect(secDefinerMatches.length).toBeGreaterThan(0);
    for (const match of secDefinerMatches) {
      expect(match).toMatch(/SET search_path\s*=\s*(public,\s*pg_temp|pg_temp,\s*public)/i);
    }
  });

  it("ensures public.entries is published to supabase_realtime", () => {
    expect(schemaSql).toMatch(/ALTER PUBLICATION supabase_realtime ADD TABLE public\.entries;/i);
  });
});
