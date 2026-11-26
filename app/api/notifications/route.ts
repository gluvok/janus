/**
 * @file app/api/notifications/route.ts
 * @description Recent rows of the `notifications` table for the dashboard bell (last 24h, newest 20).
 */

import { NextResponse } from "next/server";
import { subHours } from "date-fns";
import { withAuth, apiError, StatusCodes, forbiddenError, hasPermission } from "@/db/helpers";
import { PermissionKey, ProjectSlug, Role } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";

const WINDOW_HOURS = 24;
const LIMIT = 20;

export const GET = withAuth(async (_req, user, client) => {
  const canEntries = hasPermission(user, ProjectSlug.ENTRIES, PermissionKey.READ);
  const canWeighments = hasPermission(user, ProjectSlug.WEIGHMENTS, PermissionKey.READ);
  if (!canEntries && !canWeighments) return forbiddenError();

  const userId = Number(user.sub);
  let query = client
    .from("notifications")
    .select("kind, ref_id, vehicle_number, weight, unit, created_at")
    .gte("created_at", subHours(new Date(), WINDOW_HOURS).toISOString())
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  query =
    user.role === Role.BASE
      ? query.eq("customer_user_id", userId)
      : query.eq("factory_id", user.factory_id);
  if (!canWeighments) query = query.eq("kind", "entry");
  if (!canEntries) query = query.eq("kind", "weighment");

  const [list, me] = await Promise.all([
    query,
    client.from("users").select("notifications_seen_at").eq("id", userId).maybeSingle(),
  ]);
  if (list.error || me.error) {
    console.error("Notifications query error:", list.error ?? me.error);
    return apiError(ApiErrorMessage.DATABASE_QUERY_FAILED, StatusCodes.INTERNAL_SERVER_ERROR);
  }
  const data = (list.data ?? []).map((n) => ({ ...n, weight: Number(n.weight) }));
  return NextResponse.json({ data, seenAt: me.data?.notifications_seen_at ?? null });
});
