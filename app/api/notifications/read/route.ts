/**
 * @file app/api/notifications/read/route.ts
 * @description Batch marks notifications as read in a single SQL statement for the current user.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/db/helpers";
import { Role } from "@/lib/constants/enums";

export const POST = withAuth(async (req, user, client) => {
  const userId = Number(user.sub);
  const factoryId = Number(user.factory_id);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { notification_ids, mark_all_before_id } = body;

  let idsToMark: number[] = [];

  if (Array.isArray(notification_ids) && notification_ids.length > 0) {
    idsToMark = notification_ids
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0)
      .slice(0, 100);
  } else if (mark_all_before_id) {
    let query = client
      .from("notifications")
      .select("id")
      .eq("factory_id", factoryId)
      .lte("id", Number(mark_all_before_id));

    if (user.role === Role.BASE) {
      const { data: customer } = await client
        .from("customers")
        .select("id")
        .eq("user_id", userId)
        .eq("factory_id", factoryId)
        .maybeSingle();

      if (!customer) {
        return NextResponse.json({ success: true, markedCount: 0 });
      }

      query = query.eq("customer_id", customer.id);
    }

    const { data: rows } = await query;
    if (rows) {
      idsToMark = rows.map((r: any) => r.id);
    }
  }

  if (idsToMark.length === 0) {
    return NextResponse.json({ success: true, markedCount: 0 });
  }

  const records = idsToMark.map((notificationId) => ({
    user_id: userId,
    notification_id: notificationId,
  }));

  const { error } = await client
    .from("notification_reads")
    .upsert(records, { onConflict: "user_id,notification_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    markedCount: idsToMark.length,
  });
});
