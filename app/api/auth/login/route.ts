import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import argon2 from "argon2";
import { supabase } from "@/lib/supabase";
import { usernameSchema, passwordSchema } from "@/app/users/types";
import { createSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth";
import { handleApiRoute } from "@/lib/api-handler";

const loginSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
  })
  .strict();

export const POST = handleApiRoute(async (request: Request) => {
  const rawBody = await request.json();
  const validation = loginSchema.safeParse(rawBody);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { username, password } = validation.data;
  const cleanUsername = username.toLowerCase().trim();

  const { data: user, error: fetchErr } = await supabase
    .from("users")
    .select("id, username, password_hash, name, role, factory_id, created_at, updated_at")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json(
      { error: fetchErr.message },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: StatusCodes.UNAUTHORIZED },
    );
  }

  const isValidPassword = await argon2.verify(user.password_hash, password);
  if (!isValidPassword) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: StatusCodes.UNAUTHORIZED },
    );
  }

  const { token } = await createSession(user.id);

  const response = NextResponse.json(
    {
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        factory_id: user.factory_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      message: "Logged in successfully",
    },
    { status: StatusCodes.OK },
  );

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
});
