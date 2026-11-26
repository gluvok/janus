/**
 * @file app/api/notifications/seen/route.ts
 * @description Marks the caller's notifications as seen (server time, no body).
 */

import { NextResponse } from "next/server";
import { withAuth, apiError, StatusCodes } from "@/db/helpers";
import { ApiErrorMessage } from "@/lib/constants/messages";

export const POST = withAuth(async (_req, user, client) => {
  const seenAt = new Date().toISOString();
  const { error } = await client
    .from("users")
    .update({ notifications_seen_at: seenAt })
    .eq("id", Number(user.sub));
  if (error) {
    console.error("Mark notifications seen failed:", error);
    return apiError(ApiErrorMessage.DATABASE_QUERY_FAILED, StatusCodes.INTERNAL_SERVER_ERROR);
  }
  return NextResponse.json({ seenAt });
});
