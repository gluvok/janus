/**
 * @file app/api/notifications/route.ts
 * @description Persistent notifications endpoint for offline device catchup and read status management.
 */

import { NextResponse } from "next/server";
import { withAuth, apiError, StatusCodes } from "@/db/helpers";
import { Role } from "@/lib/constants/enums";

export const GET = withAuth(async (_req, user, client) => {
  let query = client
    .from("notifications")
    .select("*")
    .eq("factory_id", user.factory_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (user.role === Role.BASE) {
    // If base role, find corresponding customer record or match customer_id
    const { data: customer } = await client
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (customer?.id) {
      query = query.or(`customer_id.eq.${customer.id},customer_id.is.null`);
    }
  }

  const { data, error } = await query;
  if (error) {
    return apiError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return NextResponse.json({ notifications: data || [] });
});

export const PATCH = withAuth(async (req, user, client) => {
  try {
    const body = await req.json();
    const { ids, all } = body || {};

    let query = client.from("notifications").update({ read: true }).eq("factory_id", user.factory_id);

    if (Array.isArray(ids) && ids.length > 0) {
      query = query.in("id", ids);
    } else if (!all) {
      return apiError("Missing 'ids' array or 'all: true'", StatusCodes.BAD_REQUEST);
    }

    const { error } = await query;
    if (error) {
      return apiError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return apiError(err?.message || "Invalid request body", StatusCodes.BAD_REQUEST);
  }
});
