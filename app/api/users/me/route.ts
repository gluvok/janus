import { NextResponse } from "next/server";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { handleApiRoute, ServiceError, type ApiContext } from "@/lib/api-handler";
import { supabase } from "@/lib/supabase";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { updateUserAccount } from "@/app/api/users/service";
import { nameSchema, usernameSchema, passwordSchema } from "@/app/users/types";

const updateMeSchema = z
  .object({
    name: nameSchema,
    username: usernameSchema,
    password: passwordSchema.optional().or(z.literal("")),
    current_password: z.string().optional(),
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

  if (password) {
    const { data: row } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", context.user.id)
      .single();
    const ok =
      row && validation.data.current_password
        ? await verifyPassword(validation.data.current_password, row.password_hash)
        : false;
    if (!ok) throw new ServiceError("Current password is incorrect.", StatusCodes.BAD_REQUEST);
  }

  const updated = await updateUserAccount(
    {
      id: context.user.id,
      name,
      username,
      role: context.user.role,
      ...(password ? { password } : {}),
    },
    context.factory.id,
  );

  // trg_invalidate_sessions deletes this user's sessions (including this one) on username/password change.
  const reauth = Boolean(password) || updated.username !== context.user.username;
  const response = NextResponse.json({
    data: updated,
    reauth,
    message: "Account profile updated successfully.",
  });
  if (reauth) response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
});
