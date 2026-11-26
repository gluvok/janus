/**
 * @file lib/security.ts
 * @description Dependency-free security helpers (importable from proxy, client and node tests).
 */
import type { UserRole } from "@/app/users/types"; // type-only: erased under strip-types

export const SESSION_HEADER_KEYS = [
  "x-user-id",
  "x-factory-id",
  "x-user-role",
  "x-user-name",
  "x-user-username",
  "x-user-created-at",
  "x-user-updated-at",
  "x-factory-name",
  "x-factory-receipt-images",
  "x-factory-created-at",
  "x-factory-updated-at",
] as const;

export const ADMIN: readonly UserRole[] = ["admin"];
export const ADMIN_MANAGER: readonly UserRole[] = ["admin", "manager"];
export const NOTIFY_ROLES: readonly UserRole[] = ["admin", "manager", "operator"];

/** true when no role list is given or the role is in it. */
export function isRoleAllowed(roles: readonly UserRole[] | undefined, role: UserRole): boolean {
  return !roles || roles.includes(role);
}

/** Copy of `headers` without any identity header a client could forge. */
export function stripSessionHeaders(headers: Headers): Headers {
  const clean = new Headers(headers);
  for (const key of SESSION_HEADER_KEYS) clean.delete(key);
  clean.delete("x-pathname");
  return clean;
}

/** Same-origin relative path or "/". Blocks //host, /\host, schemes. */
export function safeNextPath(next: string | null | undefined): string {
  return next && /^\/(?![\\/])/.test(next) ? next : "/";
}

/** Quote a value for PostgREST or()/in() so , . : ( ) can't start a new filter. */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}
