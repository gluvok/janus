import { NextResponse } from "next/server";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { requireServerSession, AuthError } from "@/lib/auth";
import { ServiceError, updateUserAccount } from "@/app/api/users/service";
import { nameSchema, usernameSchema, passwordSchema } from "@/app/users/types";

const updateMeSchema = z
  .object({
    name: nameSchema,
    username: usernameSchema,
    password: passwordSchema.optional().or(z.literal("")),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const user = await requireServerSession(request);
    return NextResponse.json({ data: user });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireServerSession(request);
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
