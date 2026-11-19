import { describe, it, expect } from "vitest";
import packageJson from "../package.json";
import fs from "fs";
import path from "path";

describe("Version Conflict & Dependency Integrity", () => {
  it("enforces exact locked major dependencies without unexpected drift", () => {
    const deps = packageJson.dependencies as Record<string, string>;
    expect(deps["next"]).toBe("16.3.6");
    expect(deps["react"]).toBe("19.3.0");
    expect(deps["@supabase/supabase-js"]).toBe("^2.117.1");
    expect(deps["zustand"]).toBe("^5.0.15");
    expect(deps["zod"]).toBe("^4.6.5");
  });

  it("verifies pnpm-lock.yaml exists and no rogue npm/yarn locks are present", () => {
    const root = path.resolve(__dirname, "..");
    expect(fs.existsSync(path.join(root, "pnpm-lock.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(root, "package-lock.json"))).toBe(false);
    expect(fs.existsSync(path.join(root, "yarn.lock"))).toBe(false);
  });
});
