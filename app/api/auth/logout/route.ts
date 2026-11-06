import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { StatusCodes } from "http-status-codes";
import { deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { handleApiRoute } from "@/lib/api-handler";

export const POST = handleApiRoute(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)!.value;

  await deleteSession(token);

  const response = NextResponse.json(
    { message: "Logged out successfully" },
    { status: StatusCodes.OK },
  );

  response.cookies.delete(SESSION_COOKIE_NAME);

  return response;
});
