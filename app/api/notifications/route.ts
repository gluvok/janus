import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { subHours } from "date-fns";
import { handleApiRoute, ServiceError } from "@/lib/api-handler";
import { NOTIFY_ROLES } from "@/lib/security";
import { supabase } from "@/lib/supabase";

const WINDOW_HOURS = 24;
const LIMIT = 20;

export const GET = handleApiRoute(
  async (_request, { user, factory }) => {
    const [list, me] = await Promise.all([
      supabase
        .from("notifications")
        .select("kind, source, ref_id, vehicle_number, weight, created_at")
        .eq("factory_id", factory.id)
        .gte("created_at", subHours(new Date(), WINDOW_HOURS).toISOString())
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase.from("users").select("notifications_seen_at").eq("id", user.id).maybeSingle(),
    ]);
    if (list.error || me.error) {
      console.error("Notifications load failed:", list.error ?? me.error);
      throw new ServiceError("Failed to load notifications", StatusCodes.INTERNAL_SERVER_ERROR);
    }
    const data = (list.data ?? []).map((n) => ({ ...n, weight: Number(n.weight) }));
    return NextResponse.json({ data, seenAt: me.data?.notifications_seen_at ?? null });
  },
  { roles: NOTIFY_ROLES },
);
