import { NextResponse } from "next/server";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { getAuthUser } from "@/lib/auth";
import { handleApiRoute } from "@/lib/api-handler";
import { updateUserAccount } from "@/app/api/users/service";
import { nameSchema, usernameSchema, passwordSchema } from "@/app/users/types";

const updateMeSchema = z
  .object({
    name: nameSchema,
    username: usernameSchema,
    password: passwordSchema.optional().or(z.literal("")),
  })
  .strict();

export const PATCH = handleApiRoute(async (request: Request) => {
  const currentUser = getAuthUser(request);
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
  const updated = await updateUserAccount(
    {
      id: currentUser.id,
      name,
      username,
      role: currentUser.role,
      ...(password && password.trim() ? { password: password.trim() } : {}),
    },
    currentUser.factory_id,
  );

  return NextResponse.json({
    data: updated,
    message: "Account profile updated successfully.",
  });
});
