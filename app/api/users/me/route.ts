import { NextResponse } from "next/server";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { handleApiRoute, type ApiContext } from "@/lib/api-handler";
import { updateUserAccount } from "@/app/api/users/service";
import { nameSchema, usernameSchema, passwordSchema } from "@/app/users/types";

const updateMeSchema = z
  .object({
    name: nameSchema,
    username: usernameSchema,
    password: passwordSchema.optional().or(z.literal("")),
  })
  .strict();

export const GET = handleApiRoute(async (_request: Request, context: ApiContext) => {
  return NextResponse.json({
    data: {
      user: context.user,
      factory: context.factory,
    },
  });
});

export const PATCH = handleApiRoute(async (request: Request, context: ApiContext) => {
  const validation = updateMeSchema.safeParse(await request.json());

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
  const updated = await updateUserAccount(
    {
      id: context.user.id,
      name,
      username,
      role: context.user.role,
      ...(password && password.trim() ? { password: password.trim() } : {}),
    },
    context.factory.id,
  );

  return NextResponse.json({
    data: updated,
    message: "Account profile updated successfully.",
  });
});
