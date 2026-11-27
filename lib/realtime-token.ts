/**
 * @file lib/realtime-token.ts
 * @description Signs short-lived HS256 JWTs that Supabase Realtime accepts for private channels.
 */

import { createHmac } from "node:crypto";

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function signHs256(claims: Record<string, unknown>, secret: string): string {
  const unsigned = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(claims)}`;
  return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
}
