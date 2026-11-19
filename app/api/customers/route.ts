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
import { ProjectSlug, PermissionKey, Role } from "@/lib/constants/enums";
import { sanitizeSearchTerm } from "@/lib/services/common";
import { ApiErrorMessage } from "@/lib/constants/messages";
import { hashPassword } from "@/lib/auth/password";
import { addCustomerSchema } from "@/lib/validation";

export const GET = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.CUSTOMERS, PermissionKey.READ)) return forbiddenError();
  const pagination = getPaginationParams(req.nextUrl);
  const search = req.nextUrl.searchParams.get("search");
  const sortColumn = req.nextUrl.searchParams.get("sort_column") || "created_at";
  const sortDesc = req.nextUrl.searchParams.has("sort_desc")
    ? req.nextUrl.searchParams.get("sort_desc") === "true"
    : true;

  let query = client
    .from("customers")
    .select(`*, users!left(username)`, {
      count: "exact",
    })
    .order(sortColumn, { ascending: !sortDesc })
    .eq("factory_id", user.factory_id!)
    .is("deleted_at", null);

  if (user.role === Role.BASE) {
    query = query.eq("user_id", parseInt(user.sub, 10));
  }

  if (search) {
    const cleanSearch = sanitizeSearchTerm(search);
    if (cleanSearch) {
      const searchNum = parseInt(cleanSearch, 10);
      if (!isNaN(searchNum)) {
        query = query.or(
          `name.ilike.%${cleanSearch}%,father_name.ilike.%${cleanSearch}%,id.eq.${searchNum}`,
        );
      } else {
        query = query.or(`name.ilike.%${cleanSearch}%,father_name.ilike.%${cleanSearch}%`);
      }
    }
  }

  return fetchPaginatedResult(query, pagination);
});

export const POST = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.CUSTOMERS, PermissionKey.CREATE)) return forbiddenError();
  const body = await req.json();

  const factoryId = user.factory_id;

  const parsed = addCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, StatusCodes.BAD_REQUEST);
  }

  const { name, father_name, username, password } = parsed.data;

  let passwordHash: string | null = null;
  if (username && password) {
    const { data: existingUser } = await client
      .from("users")
      .select("id")
      .eq("username", username)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingUser) {
      return apiError(ApiErrorMessage.USERNAME_TAKEN, StatusCodes.BAD_REQUEST);
    }

    passwordHash = await hashPassword(password);
  }

  const { data: newCustomer, error } = await client.rpc("create_customer_with_user", {
    p_factory_id: factoryId,
    p_name: name,
    p_father_name: father_name,
    p_username: username || null,
    p_password_hash: passwordHash || null,
  });

  if (error || !newCustomer) {
    console.error("POST customer RPC error:", error);
    return apiError(
      error?.message || ApiErrorMessage.CREATE_CUSTOMER_FAILED,
      StatusCodes.BAD_REQUEST,
    );
  }

  return formatEntityResponse(newCustomer, StatusCodes.CREATED);
});

export const DELETE = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.CUSTOMERS, PermissionKey.DELETE)) return forbiddenError();
  const ids = parseBulkIds(await req.json());
  if (!ids) return apiError(ApiErrorMessage.PROVIDE_VALID_IDS, StatusCodes.BAD_REQUEST);

  // Check if any active entries are linked to any of the selected customers
  const { data: linkedEntries } = await client
    .from("entries")
    .select("id")
    .in("customer_id", ids)
    .is("deleted_at", null)
    .limit(1);

  if (linkedEntries && linkedEntries.length > 0) {
    return apiError(ApiErrorMessage.CANNOT_DELETE_SELECTED_CUSTOMERS, StatusCodes.BAD_REQUEST);
  }

  const { data: deletedCount, error } = await client.rpc("delete_customers_with_user", {
    p_customer_ids: ids,
    p_factory_id: user.factory_id,
  });

  if (error) {
    return apiError(
      error.message || ApiErrorMessage.CANNOT_DELETE_SELECTED_CUSTOMERS,
      StatusCodes.BAD_REQUEST,
    );
  }

  if (deletedCount !== ids.length) {
    return apiError(ApiErrorMessage.ONE_OR_MORE_CUSTOMERS_NOT_FOUND, StatusCodes.NOT_FOUND);
  }

  return NextResponse.json({ success: true, deleted_count: deletedCount });
});
