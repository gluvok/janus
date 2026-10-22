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
  let query = supabase.from("users").select("id").eq("username", username);

  if (excludeId !== undefined) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new ServiceError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (data) {
    throw new ServiceError(`Username "${username}" is already taken.`, StatusCodes.CONFLICT);
  }
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
 * Hard-deletes user accounts, with ON DELETE RESTRICT foreign key protection.
 */
export async function deleteUserAccounts(targetIds: number[]) {
  const { data: targetUsers, error: fetchErr } = await supabase
    .from("users")
    .select("id, username")
    .in("id", targetIds);

  if (fetchErr) {
    throw new ServiceError(fetchErr.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (!targetUsers || targetUsers.length === 0) {
    throw new ServiceError("No users found matching the specified ID(s).", StatusCodes.NOT_FOUND);
  }

  const { error: deleteErr } = await supabase.from("users").delete().in("id", targetIds);

  if (deleteErr) {
    if (deleteErr.code === "23503") {
      throw new ServiceError(
        "Cannot delete user account(s) because linked operational records (entries or tickets) exist.",
        StatusCodes.CONFLICT,
      );
    }
    throw new ServiceError(deleteErr.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return { deletedCount: targetIds.length };
}
