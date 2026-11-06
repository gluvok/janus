import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import { handleApiRoute, type ApiContext } from "@/lib/api-handler";
import {
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

const ROLE_ENTITY_LABELS: Record<UserRole, string> = {
  admin: "Staff user",
  manager: "Staff user",
  operator: "Staff user",
  base: "Staff user",
};

export const GET = handleApiRoute(async (request: Request) => {
  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], User>({
    request,
    table: "users",
    select: USER_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "id", ascending: false },
    searchColumns: ["name", "username"],
    applyCustomFilters: (query, searchParams) => {
      const roleParam = searchParams.get("role")?.trim();
      if (roleParam && roleParam !== "all") {
        const parsed = rolesFilterSchema.safeParse(roleParam);
        if (parsed.success && parsed.data.length > 0) {
          return query.in("role", parsed.data);
        }
      }
      return query;
    },
  });
});

export const POST = handleApiRoute(async (request: Request, context: ApiContext) => {
  const validation = createUserSchema.safeParse(await request.json());

  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Validation error",
        details: z.treeifyError(validation.error),
      },
      { status: StatusCodes.BAD_REQUEST },
    );
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
});

export const PATCH = handleApiRoute(async (request: Request, context: ApiContext) => {
  const validation = updateUserSchema.safeParse(await request.json());

  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Validation error",
        details: z.treeifyError(validation.error),
      },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const updated = await updateUserAccount(validation.data, context.factory.id);

  return NextResponse.json({
    data: updated,
    message: "Account updated successfully.",
  });
});

export const DELETE = handleApiRoute(async (request: Request, context: ApiContext) => {
  const validation = deleteUserSchema.safeParse(await request.json());

  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Validation error",
        details: z.treeifyError(validation.error),
      },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { deletedCount } = await deleteUserAccounts(validation.data.ids, context.factory.id);

  return NextResponse.json({
    success: true,
    message: `Successfully deleted ${deletedCount} account${deletedCount > 1 ? "s" : ""}.`,
  });
});
