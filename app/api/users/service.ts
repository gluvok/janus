import { z } from "zod";
import argon2 from "argon2";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { buildPaginatedEntityResult } from "@/lib/api-query";
import {
  userRoleEnum,
  type User,
  type UserRole,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/app/users/types";

const rolesFilterSchema = z
  .string()
  .transform((val) => {
    const parts = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const validRoles: UserRole[] = [];
    for (const part of parts) {
      const parsed = userRoleEnum.safeParse(part);
      if (parsed.success) {
        validRoles.push(parsed.data);
      }
    }
    return validRoles;
  })
  .pipe(z.array(userRoleEnum));

export const ALLOWED_SORT_COLUMNS = [
  "id",
  "username",
  "name",
  "role",
  "created_at",
  "updated_at",
] as const;

export const USER_SELECT_PROJECTION =
  "id, username, name, role, factory_id, created_at, updated_at" as const;

async function assertUsernameAvailable(username: string, excludeId?: number): Promise<void> {
  let query = supabase.from("users").select("id").eq("username", username).is("deleted_at", null);

  if (excludeId !== undefined) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new ServiceError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (data) {
    throw new ServiceError(
      `Username "${username}" is already taken by an active account.`,
      StatusCodes.CONFLICT,
    );
  }
}

function countOccurrences(
  items: unknown[] | null | undefined,
  key: string,
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const item of items ?? []) {
    if (item && typeof item === "object" && key in item) {
      const val = (item as Record<string, unknown>)[key];
      if (typeof val === "number") {
        counts[val] = (counts[val] || 0) + 1;
      }
    }
  }
  return counts;
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/**
 * Fetches a paginated, sorted, and filtered list of staff users.
 */
export async function fetchUsersList(searchParams: URLSearchParams) {
  try {
    return await buildPaginatedEntityResult<(typeof ALLOWED_SORT_COLUMNS)[number], User>({
      searchParams,
      table: "users",
      select: USER_SELECT_PROJECTION,
      allowedSortColumns: ALLOWED_SORT_COLUMNS,
      defaultSort: { col: "id", ascending: false },
      searchColumns: ["name", "username"],
      applyCustomFilters: (query, sp) => {
        const rawRole = sp.get("role")?.trim();
        if (rawRole && rawRole !== "all") {
          const parsed = rolesFilterSchema.safeParse(rawRole);
          if (parsed.success && parsed.data.length > 0) {
            return query.in("role", parsed.data);
          }
        }
        return query;
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch users";
    throw new ServiceError(msg, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Creates a new staff user account with mandatory credentials.
 */
export async function createUserAccount(data: CreateUserInput) {
  const { username, name, role, password } = data;
  const cleanUsername = username.trim().toLowerCase();

  await assertUsernameAvailable(cleanUsername);

  const passwordHash = await argon2.hash(password.trim());

  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({
      username: cleanUsername,
      name: name.trim(),
      role,
      password_hash: passwordHash,
      factory_id: 1,
    })
    .select(USER_SELECT_PROJECTION)
    .single();

  if (insertError) {
    throw new ServiceError(insertError.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return created;
}

/**
 * Updates an existing user account.
 */
export async function updateUserAccount(data: UpdateUserInput) {
  const { id, username, name, role, password } = data;

  const { data: existingUser, error: fetchErr } = await supabase
    .from("users")
    .select("id, username, role")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr) {
    throw new ServiceError(fetchErr.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (!existingUser) {
    throw new ServiceError("User not found or has been deleted.", StatusCodes.NOT_FOUND);
  }

  const cleanUsername = username.trim().toLowerCase();

  if (cleanUsername !== existingUser.username) {
    await assertUsernameAvailable(cleanUsername, id);
  }

  const updates: Record<string, unknown> = {
    username: cleanUsername,
    name: name.trim(),
    role,
    updated_at: new Date().toISOString(),
  };

  if (password && password.trim()) {
    updates.password_hash = await argon2.hash(password.trim());
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select(USER_SELECT_PROJECTION)
    .single();

  if (updateError) {
    throw new ServiceError(updateError.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return updated;
}

/**
 * Soft-deletes user accounts with batched relational pre-flight checks.
 */
export async function deleteUserAccounts(targetIds: number[]) {
  const { data: targetUsers, error: fetchErr } = await supabase
    .from("users")
    .select("id, username, role")
    .in("id", targetIds)
    .is("deleted_at", null);

  if (fetchErr) {
    throw new ServiceError(fetchErr.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (!targetUsers || targetUsers.length === 0) {
    throw new ServiceError(
      "No active users found matching the specified ID(s).",
      StatusCodes.NOT_FOUND,
    );
  }

  // Constant O(1) batched pre-flight queries
  const [entriesCreatedRes, ticketsRes] = await Promise.all([
    supabase
      .from("manual_entries")
      .select("created_by")
      .in("created_by", targetIds)
      .is("deleted_at", null),
    supabase
      .from("manual_tickets")
      .select("user_id")
      .in("user_id", targetIds)
      .is("deleted_at", null),
  ]);

  const entriesCreatedCounts = countOccurrences(entriesCreatedRes.data, "created_by");
  const ticketsCounts = countOccurrences(ticketsRes.data, "user_id");

  const blockedUsers: { id: number; username: string | null; reasons: string[] }[] = [];

  for (const u of targetUsers) {
    const reasons: string[] = [];
    const createdCount = entriesCreatedCounts[u.id] || 0;
    const tickCount = ticketsCounts[u.id] || 0;
    if (createdCount > 0) reasons.push(`${createdCount} entry(s) created`);
    if (tickCount > 0) reasons.push(`${tickCount} ticket(s)`);

    if (reasons.length > 0) {
      blockedUsers.push({ id: u.id, username: u.username, reasons });
    }
  }

  if (blockedUsers.length > 0) {
    const details = blockedUsers
      .map((b) => `"${b.username || `ID ${b.id}`}" (ID: ${b.id}) has ${b.reasons.join(", ")}`)
      .join("; ");
    throw new ServiceError(
      `Cannot delete account(s): ${details}. Historical operational records must be preserved.`,
      StatusCodes.CONFLICT,
      blockedUsers,
    );
  }

  const now = new Date().toISOString();
  const { error: deleteErr } = await supabase
    .from("users")
    .update({ deleted_at: now, updated_at: now })
    .in("id", targetIds);

  if (deleteErr) {
    throw new ServiceError(deleteErr.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return { deletedCount: targetIds.length };
}
