import { NextResponse } from "next/server";
import {
  withAuth,
  getPaginationParams,
  apiError,
  forbiddenError,
  hasPermission,
  StatusCodes,
  fetchPaginatedResult,
  formatEntityResponse,
  parseBulkIds,
} from "@/db/helpers";
import { Role, ProjectSlug, PermissionKey } from "@/lib/constants/enums";
import { sanitizeSearchTerm } from "@/lib/services/common";
import { ApiErrorMessage } from "@/lib/constants/messages";
import { addUserSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { canDeleteUserRole } from "@/lib/store";

export const GET = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.USERS, PermissionKey.READ)) return forbiddenError();
  const pagination = getPaginationParams(req.nextUrl);
  const search = req.nextUrl.searchParams.get("search");
  const sortColumn = req.nextUrl.searchParams.get("sort_column") || "created_at";
  const sortDesc = req.nextUrl.searchParams.has("sort_desc")
    ? req.nextUrl.searchParams.get("sort_desc") === "true"
    : true;
  const roleParam = req.nextUrl.searchParams.get("role");

  const factoryId = user.factory_id;

  let query = client
    .from("users")
    .select("id, username, name, role, factory_id, created_at, updated_at", {
      count: "exact",
    })
    .order(sortColumn, { ascending: !sortDesc })
    .eq("factory_id", factoryId)
    .neq("role", Role.HARDWARE)
    .is("deleted_at", null);

  if (roleParam && roleParam !== "all") {
    query = query.eq("role", roleParam);
  }

  if (search) {
    const cleanSearch = sanitizeSearchTerm(search);
    if (cleanSearch) {
      const searchNum = parseInt(cleanSearch, 10);
      if (!isNaN(searchNum)) {
        query = query.or(
          `name.ilike.%${cleanSearch}%,username.ilike.%${cleanSearch}%,id.eq.${searchNum}`,
        );
      } else {
        query = query.or(`name.ilike.%${cleanSearch}%,username.ilike.%${cleanSearch}%`);
      }
    }
  }

  return fetchPaginatedResult(query, pagination);
});

export const POST = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.USERS, PermissionKey.CREATE)) return forbiddenError();
  const body = await req.json();
  const factoryId = user.factory_id;

  const parsed = addUserSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return apiError(firstIssue.message, StatusCodes.BAD_REQUEST);
  }

  const { name, username, password, role } = parsed.data;

  if ((role as string) === Role.HARDWARE) {
    return apiError(
      "Hardware accounts can only be provisioned directly in database by DB owner",
      StatusCodes.FORBIDDEN,
    );
  }

  const { data: existingUser } = await client
    .from("users")
    .select("id")
    .eq("username", username)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingUser) return apiError(ApiErrorMessage.USERNAME_TAKEN, StatusCodes.BAD_REQUEST);

  // RBAC Hierarchy Verification
  if (user.role === Role.MANAGER && ![Role.OPERATOR, Role.BASE].includes(role)) {
    return forbiddenError();
  }

  const password_hash = await hashPassword(password);
  const now = new Date().toISOString();

  const insertValues: Record<string, unknown> = {
    username,
    password_hash,
    name,
    role,
    factory_id: factoryId,
    created_at: now,
    updated_at: now,
  };

  const { data: newUser, error: insertError } = await client
    .from("users")
    .insert(insertValues)
    .select()
    .single();

  if (insertError) {
    console.error("POST user error:", insertError);
    return apiError(
      insertError.message || ApiErrorMessage.CREATE_USER_FAILED,
      StatusCodes.BAD_REQUEST,
    );
  }

  return formatEntityResponse(newUser, StatusCodes.CREATED);
});

export const DELETE = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.USERS, PermissionKey.DELETE)) return forbiddenError();
  const ids = parseBulkIds(await req.json());
  if (!ids) return apiError(ApiErrorMessage.PROVIDE_VALID_IDS, StatusCodes.BAD_REQUEST);

  // Block self-deletion
  const currentUserId = parseInt(user.sub, 10);
  if (ids.includes(currentUserId)) return forbiddenError();

  // Fetch target users and enforce role hierarchy
  const { data: targetUsers } = await client
    .from("users")
    .select("id, role")
    .in("id", ids)
    .eq("factory_id", user.factory_id)
    .is("deleted_at", null);

  const hasUnallowed = targetUsers?.some(
    (t) => !canDeleteUserRole(user.role as Role, t.role as Role),
  );
  if (hasUnallowed) return forbiddenError();

  // Check if any active customers are linked to any of the selected users
  const { data: linkedCustomers } = await client
    .from("customers")
    .select("id")
    .in("user_id", ids)
    .is("deleted_at", null)
    .limit(1);

  if (linkedCustomers && linkedCustomers.length > 0) {
    return apiError(ApiErrorMessage.CANNOT_DELETE_SELECTED_USERS, StatusCodes.BAD_REQUEST);
  }

  const query = client
    .from("users")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .is("deleted_at", null)
    .eq("factory_id", user.factory_id);

  const { data, error } = await query.select("id");
  if (error) {
    return apiError(
      error.message || ApiErrorMessage.CANNOT_DELETE_SELECTED_USERS,
      StatusCodes.BAD_REQUEST,
    );
  }

  if (!data || data.length !== ids.length) {
    return apiError(ApiErrorMessage.ONE_OR_MORE_USERS_NOT_FOUND, StatusCodes.NOT_FOUND);
  }

  return NextResponse.json({ success: true, deleted_count: data.length });
});
