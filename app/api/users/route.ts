import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  type UserRole,
} from "@/app/users/types";
import {
  fetchUsersList,
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
    const { searchParams } = new URL(request.url);
    const paginatedResponse = await fetchUsersList(searchParams);
    return NextResponse.json(paginatedResponse);
  } catch (err: unknown) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function POST(request: Request) {
  try {
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

    const created = await createUserAccount(validation.data);
    const label = ROLE_ENTITY_LABELS[validation.data.role] ?? "Account";

    return NextResponse.json(
      {
        data: created,
        message: `${label} created successfully.`,
      },
      { status: StatusCodes.CREATED },
    );
  } catch (err: unknown) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(request: Request) {
  try {
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
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function DELETE(request: Request) {
  try {
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
