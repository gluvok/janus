import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { LRUCache } from "lru-cache";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { supabase } from "@/lib/supabase";
import { usernameSchema, passwordSchema } from "@/app/users/types";
import {
  createSession,
  sessionCutoffIso,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

const MAX_FAILED_LOGINS = 5;
// ponytail: per-instance counter; move to a DB/Redis counter if instances scale out.
const failedLogins = new LRUCache<string, number>({ max: 10_000, ttl: 15 * 60_000 });
const INVALID = "Invalid username or password.";

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

    if ((failedLogins.get(username) ?? 0) >= MAX_FAILED_LOGINS) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: StatusCodes.TOO_MANY_REQUESTS },
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username, password_hash, name, role, factory_id, created_at, updated_at")
      .eq("username", username)
      .is("deleted_at", null)
      .maybeSingle();

    if (userError) {
      console.error("Login user lookup failed:", userError);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    const isValidPassword = user
      ? await verifyPassword(password, user.password_hash)
      : (await verifyPassword(password, DUMMY_HASH), false);
    if (!user || !isValidPassword) {
      failedLogins.set(username, (failedLogins.get(username) ?? 0) + 1);
      return NextResponse.json({ error: INVALID }, { status: StatusCodes.UNAUTHORIZED });
    }
    failedLogins.delete(username);

    const { token } = await createSession(user.id);
    await supabase
      .from("sessions")
      .delete()
      .eq("user_id", user.id)
      .lt("created_at", sessionCutoffIso());

    const { data: factory, error: factoryError } = await supabase
      .from("factories")
      .select("*")
      .eq("id", user.factory_id)
      .single();
    if (factoryError) {
      console.error("Login factory lookup failed:", factoryError);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }
    if (!factory) {
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
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }
}
