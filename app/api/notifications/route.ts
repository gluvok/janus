/**
 * @file app/api/notifications/route.ts
 * @description Recent entries + merged weighments for the dashboard bell (last 24h, newest 20).
 */

import { NextResponse } from "next/server";
import { subHours } from "date-fns";
import { withAuth, apiError, StatusCodes, forbiddenError, hasPermission } from "@/db/helpers";
import {
  EntrySource,
  PermissionKey,
  ProjectSlug,
  Role,
  type EntryStatus,
  type Unit,
  type WeighmentType,
} from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";
import type { DashboardNotification } from "@/types";

const WINDOW_HOURS = 24;
const LIMIT = 20;

interface EntryRow {
  id: number;
  vehicle_number: string;
  detected_vehicle_number: string | null;
  weight: number;
  status: EntryStatus;
  auto_approved: boolean;
  created_at: string;
  centers: { name: string } | null;
  created_by_user: { role: Role } | null;
}

interface WeighmentRow {
  id: number;
  unit: Unit;
  type: WeighmentType;
  created_at: string;
  in_entry: { weight: number; vehicle_number: string; centers: { name: string } | null };
  out_entry: { weight: number } | null;
}

const EMPTY = { data: [], error: null };

export const GET = withAuth(async (_req, user, client) => {
  const canEntries = hasPermission(user, ProjectSlug.ENTRIES, PermissionKey.READ);
  const canWeighments = hasPermission(user, ProjectSlug.WEIGHMENTS, PermissionKey.READ);
  if (!canEntries && !canWeighments) return forbiddenError();

  const since = subHours(new Date(), WINDOW_HOURS).toISOString();
  const isBase = user.role === Role.BASE;
  const userId = parseInt(user.sub, 10);
  const customerJoin = isBase ? ", customers!inner(user_id)" : "";

  const entriesQuery = () => {
    const q = client
      .from("entries")
      .select(
        `id, vehicle_number, detected_vehicle_number, weight, status, auto_approved, created_at, centers!inner(name, factory_id), created_by_user:users!created_by(role)${customerJoin}`,
      )
      .eq("centers.factory_id", user.factory_id!)
      .is("deleted_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    return isBase ? q.eq("customers.user_id", userId) : q;
  };

  const weighmentsQuery = () => {
    const q = client
      .from("weighments")
      .select(
        `id, unit, type, created_at, in_entry:entries!in_entry_id!inner(weight, vehicle_number, centers!inner(name, factory_id)${customerJoin}), out_entry:entries!out_entry_id(weight)`,
      )
      .eq("in_entry.centers.factory_id", user.factory_id!)
      .is("deleted_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    return isBase ? q.eq("in_entry.customers.user_id", userId) : q;
  };

  const [entries, weighments] = await Promise.all([
    canEntries ? entriesQuery() : EMPTY,
    canWeighments ? weighmentsQuery() : EMPTY,
  ]);

  const error = entries.error ?? weighments.error;
  if (error) {
    console.error("Notifications query error:", error);
    return apiError(ApiErrorMessage.DATABASE_QUERY_FAILED, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  const data: DashboardNotification[] = [
    ...((entries.data ?? []) as unknown as EntryRow[]).map(toEntryNotification),
    ...((weighments.data ?? []) as unknown as WeighmentRow[]).map(toWeighmentNotification),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, LIMIT);

  return NextResponse.json({ data });
});

function toEntryNotification(row: EntryRow): DashboardNotification {
  return {
    kind: "entry",
    id: row.id,
    vehicle_number: row.vehicle_number,
    detected_vehicle_number: row.detected_vehicle_number,
    center_name: row.centers?.name ?? null,
    created_at: row.created_at,
    weight: Number(row.weight),
    status: row.status,
    auto_approved: row.auto_approved,
    source: row.created_by_user?.role === Role.HARDWARE ? EntrySource.DEVICE : EntrySource.MANUAL,
  };
}

function toWeighmentNotification(row: WeighmentRow): DashboardNotification {
  const inWeight = Number(row.in_entry.weight);
  const outWeight = Number(row.out_entry?.weight ?? 0);
  return {
    kind: "weighment",
    id: row.id,
    vehicle_number: row.in_entry.vehicle_number,
    center_name: row.in_entry.centers?.name ?? null,
    created_at: row.created_at,
    in_weight: inWeight,
    out_weight: outWeight,
    net_weight: Math.abs(inWeight - outWeight), // mirrors SQL net_weight()
    unit: row.unit,
    type: row.type,
  };
}
