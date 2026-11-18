/**
 * @file app/api/notifications/route.ts
 * @description API route for fetching unread and recent notifications with per-user read state and tenant isolation.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/db/helpers";
import { Role } from "@/lib/constants/enums";

export const GET = withAuth(async (_req, user, client) => {
  const userId = Number(user.sub);
  const factoryId = Number(user.factory_id);

  let query = client
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
    .eq("factory_id", factoryId);

  // Tenant & Customer Isolation: Base users (customers) may ONLY access their own notifications
  if (user.role === Role.BASE) {
    const { data: customer } = await client
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .eq("factory_id", factoryId)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    query = query.eq("customer_id", customer.id);
  }

  const { data: rawNotifications, error } = await query
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
