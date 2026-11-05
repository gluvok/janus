import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { StatusCodes } from "http-status-codes";
import { deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await deleteSession(token);
    }

    const response = NextResponse.json(
      { message: "Logged out successfully" },
      { status: StatusCodes.OK },
    );

    response.cookies.delete(SESSION_COOKIE_NAME);

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

