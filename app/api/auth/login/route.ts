import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import argon2 from "argon2";
import { supabase } from "@/lib/supabase";
import { usernameSchema, passwordSchema } from "@/app/users/types";
import { createSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth";

const loginSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
  })
  .strict();

export async function POST(request: Request) {
  try {
    const validation = loginSchema.safeParse(await request.json());

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { username, password } = validation.data;

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, password_hash, name, role, factory_id, created_at, updated_at")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: StatusCodes.UNAUTHORIZED });
    }

    const isValidPassword = await argon2.verify(user.password_hash, password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: StatusCodes.UNAUTHORIZED },
      );
    }

    const { token } = await createSession(user.id);

    const { data: factory, error: factoryError } = await supabase
      .from("factories")
      .select("*")
      .eq("id", user.factory_id)
      .single();

    if (factoryError || !factory) {
      return NextResponse.json(
        { error: "Factory not found for user." },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    const response = NextResponse.json(
      {
        data: {
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            factory_id: user.factory_id,
            created_at: user.created_at,
            updated_at: user.updated_at,
          },
          factory,
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
