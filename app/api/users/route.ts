import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import { requireServerSession, AuthError } from "@/lib/auth";
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
  ServiceError,
} from "./service";

const ROLE_ENTITY_LABELS: Record<UserRole, string> = {
  admin: "Staff user",
  manager: "Staff user",
  operator: "Staff user",
  base: "Staff user",
};

export async function GET(request: Request) {
  try {
    const user = await requireServerSession(request);

    return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], User>({
      request,
      table: "users",
      select: USER_SELECT_PROJECTION,
      allowedSortColumns: ALLOWED_SORT_COLUMNS,
      defaultSort: { col: "id", ascending: false },
      searchColumns: ["name", "username"],
      applyCustomFilters: (query, searchParams) => {
        let filteredQuery = query.eq("factory_id", user.factory_id);

        const rawRole = searchParams.get("role")?.trim();
        if (rawRole && rawRole !== "all") {
          const parsed = rolesFilterSchema.safeParse(rawRole);
          if (parsed.success && parsed.data.length > 0) {
            filteredQuery = filteredQuery.in("role", parsed.data);
          }
        }
        return filteredQuery;
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireServerSession(request);
    const rawBody = await request.json();
    const validation = createUserSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: z.treeifyError(validation.error),
        },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const created = await createUserAccount(validation.data, user.factory_id);
    const label = ROLE_ENTITY_LABELS[validation.data.role] ?? "Account";

    return NextResponse.json(
      {
        data: created,
        message: `${label} created successfully.`,
      },
      { status: StatusCodes.CREATED },
    );
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireServerSession(request);
    const rawBody = await request.json();
    const validation = updateUserSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: z.treeifyError(validation.error),
        },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const updated = await updateUserAccount(validation.data);

    return NextResponse.json({
      data: updated,
      message: "Account updated successfully.",
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireServerSession(request);
    const rawBody = await request.json();
    const validation = deleteUserSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: z.treeifyError(validation.error),
        },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { deletedCount } = await deleteUserAccounts(validation.data.ids);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} account${deletedCount > 1 ? "s" : ""}.`,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof ServiceError) {
      return NextResponse.json(
        {
          error: err.message,
          ...(err.details ? { blockedUsers: err.details } : {}),
        },
        { status: err.statusCode },
      );
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
