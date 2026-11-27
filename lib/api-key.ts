/**
 * @file lib/api-key.ts
 * @description Center API keys: SHA-256 at rest, looked up by hash. Server-only (node:crypto), no @/ imports.
 */
import { createHash, randomBytes } from "node:crypto";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** 256-bit, URL-safe: fits an x-api-key header and Hermes's license file. */
export function generateApiKey(): string {
  return randomBytes(32).toString("base64url");
}
