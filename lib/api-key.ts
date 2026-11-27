/**
 * @file lib/api-key.ts
 * @description Center API keys: SHA-256 at rest, constant-time compare. Server-only (node:crypto), no @/ imports.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Compared against when the center doesn't exist, so unknown id and wrong key take the same path. */
export const DUMMY_KEY_HASH = "0".repeat(64);

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Both sides are 32-byte digests, so timingSafeEqual never sees unequal lengths from user input. */
export function apiKeyMatches(key: string, storedHash: string): boolean {
  const given = createHash("sha256").update(key, "utf8").digest();
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === given.length && timingSafeEqual(given, stored);
}

/** 256-bit, URL-safe: fits a Basic password and Hermes's license file. */
export function generateApiKey(): string {
  return randomBytes(32).toString("base64url");
}
