import { z } from "zod";
import argon2 from "argon2";
import { StatusCodes } from "http-status-codes";
import { and, eq, ne, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
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
  const conditions = [eq(schema.users.username, username)];
  if (excludeId !== undefined) {
    conditions.push(ne(schema.users.id, excludeId));
  }

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(...conditions))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
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
      applyCustomFilters: (whereConditions, sp) => {
        const rawRole = sp.get("role")?.trim();
        if (rawRole && rawRole !== "all") {
          const parsed = rolesFilterSchema.safeParse(rawRole);
          if (parsed.success && parsed.data.length > 0) {
            whereConditions.push(inArray(schema.users.role, parsed.data));
          }
        }
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

  const [created] = await db
    .insert(schema.users)
    .values({
      username: cleanUsername,
      name: name.trim(),
      role,
      password_hash: passwordHash,
      factory_id: 1,
    })
    .returning({
      id: schema.users.id,
      username: schema.users.username,
      name: schema.users.name,
      role: schema.users.role,
      factory_id: schema.users.factory_id,
      created_at: schema.users.created_at,
      updated_at: schema.users.updated_at,
    });

  return created;
}

/**
 * Updates an existing user account.
 */
export async function updateUserAccount(data: UpdateUserInput) {
  const { id, username, name, role, password } = data;

  const existingUser = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1)
    .then((rows) => rows[0]);

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

  const [updated] = await db
    .update(schema.users)
    .set(updates)
    .where(eq(schema.users.id, id))
    .returning({
      id: schema.users.id,
      username: schema.users.username,
      name: schema.users.name,
      role: schema.users.role,
      factory_id: schema.users.factory_id,
      created_at: schema.users.created_at,
      updated_at: schema.users.updated_at,
    });

  return updated;
}

/**
 * Hard-deletes user accounts, with ON DELETE RESTRICT foreign key protection.
 */
export async function deleteUserAccounts(targetIds: number[]) {
  const targetUsers = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(inArray(schema.users.id, targetIds));

  if (!targetUsers || targetUsers.length === 0) {
    throw new ServiceError("No users found matching the specified ID(s).", StatusCodes.NOT_FOUND);
  }

  try {
    await db.delete(schema.users).where(inArray(schema.users.id, targetIds));
  } catch (dbErr) {
    const isForeignKeyViolation =
      dbErr instanceof Error &&
      (dbErr.message.includes("FOREIGN KEY") ||
        dbErr.message.includes("constraint failed") ||
        (dbErr as { code?: string }).code === "23503" ||
        (dbErr as { code?: string }).code === "SQLITE_CONSTRAINT");

    if (isForeignKeyViolation) {
      throw new ServiceError(
        "Cannot delete user account(s) because linked operational records (entries or tickets) exist.",
        StatusCodes.CONFLICT,
      );
    }
    throw new ServiceError(
      dbErr instanceof Error ? dbErr.message : "Failed to delete users",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  return { deletedCount: targetIds.length };
}
