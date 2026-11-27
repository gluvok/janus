import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { handleApiRoute, ServiceError } from "@/lib/api-handler";
import { NOTIFY_ROLES } from "@/lib/security";
import { supabase } from "@/lib/supabase";

export const POST = handleApiRoute(
  async (_request, { user }) => {
    const seenAt = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({ notifications_seen_at: seenAt })
      .eq("id", user.id);
    if (error) {
      console.error("Mark notifications seen failed:", error);
      throw new ServiceError("Failed to update notifications", StatusCodes.INTERNAL_SERVER_ERROR);
    }
    return NextResponse.json({ seenAt });
  },
  { roles: NOTIFY_ROLES },
);
