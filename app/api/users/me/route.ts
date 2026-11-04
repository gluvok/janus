import { NextResponse } from "next/server";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { and, eq, asc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { ServiceError, updateUserAccount } from "@/app/api/users/service";
import { nameSchema, usernameSchema, passwordSchema } from "@/app/users/types";

const updateMeSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  password: passwordSchema.optional().or(z.literal("")),
});

async function getCurrentUser() {
  const user = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      name: schema.users.name,
      role: schema.users.role,
      factory_id: schema.users.factory_id,
      created_at: schema.users.created_at,
      updated_at: schema.users.updated_at,
    })
    .from(schema.users)
    .where(and(eq(schema.users.role, "admin"), eq(schema.users.factory_id, 1)))
    .orderBy(asc(schema.users.id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) {
    throw new ServiceError("Primary account not found.", StatusCodes.NOT_FOUND);
  }

  return user;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ data: user });
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
    const currentUser = await getCurrentUser();
    const rawBody = await request.json();
    const validation = updateMeSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: z.treeifyError(validation.error),
        },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { name, username, password } = validation.data;
    const updated = await updateUserAccount({
      id: currentUser.id,
      name,
      username,
      role: currentUser.role,
      ...(password && password.trim() ? { password: password.trim() } : {}),
    });

    return NextResponse.json({
      data: updated,
      message: "Account profile updated successfully.",
    });
  } catch (err: unknown) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
