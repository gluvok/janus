import { z } from "zod";
import argon2 from "argon2";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { updateUserSessionCache, invalidateAllUserSessionCache } from "@/lib/auth";
import {
  userRoleEnum,
  type UserRole,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/app/users/types";

export const rolesFilterSchema = z
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
 * Creates a new staff user account with mandatory credentials and dynamic factory_id.
 * Relies directly on PostgreSQL UNIQUE constraint for atomic concurrency protection.
 */
export async function createUserAccount(data: CreateUserInput, factoryId: number) {
  const { username, name, role, password } = data;
  const cleanUsername = username.trim().toLowerCase();
  const passwordHash = await argon2.hash(password.trim());

  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({
      username: cleanUsername,
      name: name.trim(),
      role,
      password_hash: passwordHash,
      factory_id: factoryId,
    })
    .select(USER_SELECT_PROJECTION)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new ServiceError(`Username "${cleanUsername}" is already taken.`, StatusCodes.CONFLICT);
    }
    throw new ServiceError(insertError.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return created;
}

/**
 * Updates an existing user account.
 * Atomically enforces uniqueness via PostgreSQL unique constraints.
 */
export async function updateUserAccount(data: UpdateUserInput, factoryId: number) {
  const { id, username, name, role, password } = data;
  const cleanUsername = username.trim().toLowerCase();

  const updates: Record<string, unknown> = {
    username: cleanUsername,
    name: name.trim(),
    role,
  };

  if (password && password.trim()) {
    updates.password_hash = await argon2.hash(password.trim());
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .eq("factory_id", factoryId)
    .select(USER_SELECT_PROJECTION)
    .maybeSingle();

  if (updateError) {
    if (updateError.code === "23505") {
      throw new ServiceError(`Username "${cleanUsername}" is already taken.`, StatusCodes.CONFLICT);
    }
    throw new ServiceError(updateError.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (!updated) {
    throw new ServiceError("User not found or has been deleted.", StatusCodes.NOT_FOUND);
  }

  updateUserSessionCache(updated.id, updated);

  return updated;
}

/**
 * Hard-deletes user accounts in a single batch operation with ON DELETE RESTRICT protection.
 */
export async function deleteUserAccounts(targetIds: number[], factoryId: number) {
  const { data, error: deleteErr } = await supabase
    .from("users")
    .delete()
    .in("id", targetIds)
    .eq("factory_id", factoryId)
    .select("id");

  if (deleteErr) {
    if (deleteErr.code === "23503") {
      throw new ServiceError(
        "Cannot delete user account(s) because linked operational records (weighments or tickets) exist.",
        StatusCodes.CONFLICT,
      );
    }
    throw new ServiceError(deleteErr.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (!data || data.length === 0) {
    throw new ServiceError("No users found matching the specified ID(s).", StatusCodes.NOT_FOUND);
  }

  for (const id of targetIds) {
    invalidateAllUserSessionCache(id);
  }

  return { deletedCount: data.length };
}
