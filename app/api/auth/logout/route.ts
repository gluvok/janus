import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { StatusCodes } from "http-status-codes";
import { SESSION_COOKIE_NAME, invalidateSessionCache } from "@/lib/auth";
import { handleApiRoute } from "@/lib/api-handler";
import { supabase } from "@/lib/supabase";

export const POST = handleApiRoute(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  // 1. Clean up database session and in-memory cache if a token was present
  if (token) {
    invalidateSessionCache(token);
    await supabase.from("sessions").delete().eq("token", token);
  }

  const response = NextResponse.json(
    { message: "Logged out successfully" },
    { status: StatusCodes.OK },
  );

  // 2. Always strip the cookie from the browser
  response.cookies.delete(SESSION_COOKIE_NAME);

  return response;
});
