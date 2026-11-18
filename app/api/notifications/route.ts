/**
 * @file app/api/notifications/route.ts
 * @description API route for fetching unread and recent notifications with per-user read state.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/db/helpers";

export const GET = withAuth(async (_req, user, client) => {
  const userId = Number(user.id);
  const factoryId = Number(user.factory_id);

  const { data: rawNotifications, error } = await client
    .from("notifications")
    .select(
      `
      id,
      factory_id,
      customer_id,
      entry_id,
      title,
      message,
      vehicle_number,
      weight,
      center_name,
      created_at,
      notification_reads!left(read_at)
    `,
    )
    .eq("factory_id", factoryId)
    .order("id", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications = (rawNotifications || []).map((n: any) => {
    const isRead = Array.isArray(n.notification_reads) && n.notification_reads.length > 0;
    return {
      id: `entry-${n.id}`,
      notificationId: n.id,
      entryId: n.entry_id,
      title: n.title,
      vehicleNumber: n.vehicle_number,
      weight: n.weight,
      centerName: n.center_name || "Main Weighbridge",
      createdAt: n.created_at,
      read: isRead,
    };
  });

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  return NextResponse.json({
    notifications,
    unreadCount,
  });
});
