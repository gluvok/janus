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
