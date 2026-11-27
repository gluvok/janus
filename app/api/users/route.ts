import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import {
  executePaginatedEntityQuery,
  executeAllEntityQuery,
  type PaginatedEntityQueryOptions,
} from "@/lib/api-query";
import { handleApiRoute, validationErrorResponse, type ApiContext } from "@/lib/api-handler";
import {
  USER_ROLES,
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  type User,
  type UserRole,
} from "@/app/users/types";
import {
  ALLOWED_SORT_COLUMNS,
  USER_SELECT_PROJECTION,
  rolesFilterSchema,
  createUserAccount,
  updateUserAccount,
  deleteUserAccounts,
} from "./service";
import { ADMIN } from "@/lib/security";

const ROLE_ENTITY_LABELS: Record<UserRole, string> = {
  admin: "Staff user",
  manager: "Staff user",
  operator: "Staff user",
  base: "Staff user",
};

export const GET = handleApiRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const options: PaginatedEntityQueryOptions<(typeof ALLOWED_SORT_COLUMNS)[number]> = {
    request,
    table: "users",
    select: USER_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "id", ascending: false },
    searchColumns: ["name", "username"],
    integerColumns: ["id"],
    enumColumns: [{ column: "role", values: USER_ROLES }],
    applyCustomFilters: (query, params) => {
      let filtered = query.in("role", USER_ROLES).is("deleted_at", null);
      const roleParam = params.get("role")?.trim();
      if (roleParam && roleParam !== "all") {
        const parsed = rolesFilterSchema.safeParse(roleParam);
        if (parsed.success && parsed.data.length > 0) {
          filtered = filtered.in("role", parsed.data);
        }
      }
      return filtered;
    },
  };

  if (searchParams.get("all") === "true") {
    return executeAllEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], User>(options);
  }

  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], User>(options);
});

export const POST = handleApiRoute(
  async (request: Request, context: ApiContext) => {
    const validation = createUserSchema.safeParse(await request.json());

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const created = await createUserAccount(validation.data, context.factory.id);
    const label = ROLE_ENTITY_LABELS[validation.data.role];

    return NextResponse.json(
      {
        data: created,
        message: `${label} created successfully.`,
      },
      { status: StatusCodes.CREATED },
    );
  },
  { roles: ADMIN },
);

export const PATCH = handleApiRoute(
  async (request: Request, context: ApiContext) => {
    const validation = updateUserSchema.safeParse(await request.json());

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const updated = await updateUserAccount(validation.data, context.factory.id);

    return NextResponse.json({
      data: updated,
      message: "Account updated successfully.",
    });
  },
  { roles: ADMIN },
);

export const DELETE = handleApiRoute(
  async (request: Request, context: ApiContext) => {
    const validation = deleteUserSchema.safeParse(await request.json());

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { deletedCount } = await deleteUserAccounts(validation.data.ids, context.factory.id);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} account${deletedCount > 1 ? "s" : ""}.`,
    });
  },
  { roles: ADMIN },
);
