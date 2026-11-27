import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { invalidateAllUserSessionCache } from "@/lib/auth";
import { ServiceError } from "@/lib/api-handler";
import {
  userRoleEnum,
  type UserRole,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/app/users/types";

export { ServiceError };

const roleOrDropped = z.union([userRoleEnum, z.string().transform(() => undefined)]);

// "admin, nope,manager" -> ["admin", "manager"]: parts are trimmed; unknown/empty parts are dropped.
export const rolesFilterSchema = z
  .string()
  .transform((val) => val.split(","))
  .pipe(z.array(z.string().trim().pipe(roleOrDropped)))
  .transform((roles) => roles.filter((role): role is UserRole => role !== undefined));

export const ALLOWED_SORT_COLUMNS = [
  "id",
  "username",
  "name",
  "role",
  "created_at",
  "updated_at",
] as const;

const MAX_LINKED_ENTRIES_SHOWN = 20;

export const USER_SELECT_PROJECTION =
  "id, username, name, role, factory_id, created_at, updated_at" as const;

/** Relies on the PostgreSQL UNIQUE constraint on username to reject concurrent duplicates. */
export async function createUserAccount(data: CreateUserInput, factoryId: number) {
  const { username, name, role, password } = data;
  const passwordHash = await hashPassword(password);

  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({
      username,
      name,
      role,
      password_hash: passwordHash,
      factory_id: factoryId,
    })
    .select(USER_SELECT_PROJECTION)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new ServiceError(`Username "${username}" is already taken.`, StatusCodes.CONFLICT);
    }
    console.error("User insert failed:", insertError);
    throw new ServiceError("Failed to create user.", StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return created;
}

/** Relies on the PostgreSQL UNIQUE constraint on username to reject concurrent duplicates. */
export async function updateUserAccount(data: UpdateUserInput, factoryId: number) {
  const { id, username, name, role, password } = data;

  const updates: Record<string, unknown> = { username, name, role };

  // "" means "keep current password" (updateUserSchema).
  if (password) {
    updates.password_hash = await hashPassword(password);
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
      throw new ServiceError(`Username "${username}" is already taken.`, StatusCodes.CONFLICT);
    }
    console.error("User update failed:", updateError);
    throw new ServiceError("Failed to update user.", StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (!updated) {
    throw new ServiceError("User not found or has been deleted.", StatusCodes.NOT_FOUND);
  }

  // DB trigger trg_invalidate_sessions deletes rows on role/username/password change; drop cached copies too.
  invalidateAllUserSessionCache(updated.id);

  return updated;
}

/** Relies on ON DELETE RESTRICT foreign keys to block deleting users with linked records. */
export async function deleteUserAccounts(targetIds: number[], factoryId: number) {
  const { data, error: deleteErr } = await supabase
    .from("users")
    .delete()
    .in("id", targetIds)
    .eq("factory_id", factoryId)
    .select("id");

  if (deleteErr) {
    if (deleteErr.code === "23503") {
      // manual_entries.creator_id is ON DELETE RESTRICT and soft-deleted rows still count, so no deleted_at filter.
      const { data: linked, error: linkedErr } = await supabase
        .from("manual_entries")
        .select("id")
        .in("creator_id", targetIds)
        .order("id")
        .limit(MAX_LINKED_ENTRIES_SHOWN);
      if (linkedErr) console.error("Linked manual entries lookup failed:", linkedErr);

      throw new ServiceError(
        linked?.length
          ? `Cannot delete: user is linked to manual entries ${linked.map((e) => `#${e.id}`).join(", ")} (including deleted ones).`
          : "Cannot delete user account(s) because linked operational records (weighments or entries) exist.",
        StatusCodes.CONFLICT,
      );
    }
    console.error("User delete failed:", deleteErr);
    throw new ServiceError("Failed to delete user.", StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (!data || data.length === 0) {
    throw new ServiceError("No users found matching the specified ID(s).", StatusCodes.NOT_FOUND);
  }

  for (const id of targetIds) {
    invalidateAllUserSessionCache(id);
  }

  return { deletedCount: data.length };
}
