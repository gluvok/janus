import { NextResponse } from "next/server";
import {
  withAuth,
  withEntityScope,
  apiError,
  StatusCodes,
  forbiddenError,
  hasPermission,
} from "@/db/helpers";
import { WeighmentType, ProjectSlug, PermissionKey, Role } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";
import { editWeighmentSchema } from "@/lib/validation";
import { formatWeighmentRecord, deleteWeighments } from "@/lib/services/weighments";

export const GET = withAuth<{ id: string }>(async (_req, user, client, ctx) => {
  if (!hasPermission(user, ProjectSlug.WEIGHMENTS, PermissionKey.READ)) return forbiddenError();
  const { id } = await ctx.params;
  const weighmentId = Number(id);

  const { data: row, error } = await client
    .from("weighments")
    .select(
      `*, in_entry:entries!in_entry_id!inner(id, weight, images, created_at, center_id, created_by, approved_by, customer_id, vehicle_number, detected_vehicle_number, status, auto_approved, centers(name), users:users!created_by(name), customers(name, user_id)), out_entry:entries!out_entry_id(id, weight, images, created_at, center_id, created_by, approved_by, customer_id, vehicle_number, detected_vehicle_number, status, auto_approved, centers(name), users:users!created_by(name), customers(name, user_id))`,
    )
    .eq("id", weighmentId)
    .eq("in_entry.factory_id", user.factory_id!)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !row) {
    return apiError(ApiErrorMessage.WEIGHMENT_NOT_FOUND, StatusCodes.NOT_FOUND);
  }

  const inEntry = (row["in_entry"] as Record<string, unknown>) || {};
  const outEntry = (row["out_entry"] as Record<string, unknown>) || {};

  if (user.role === Role.BASE) {
    const userId = parseInt(user.sub, 10);
    const inCustomer = inEntry.customers as { user_id?: number } | undefined;
    const outCustomer = outEntry.customers as { user_id?: number } | undefined;
    const isOwnCustomer = inCustomer?.user_id === userId || outCustomer?.user_id === userId;

    if (!isOwnCustomer) {
      return apiError(ApiErrorMessage.WEIGHMENT_NOT_FOUND, StatusCodes.NOT_FOUND);
    }
  }

  const formatted = formatWeighmentRecord(row);

  return NextResponse.json({ data: formatted });
});

export const PATCH = withAuth<{ id: string }>(async (req, user, client, ctx) => {
  if (!hasPermission(user, ProjectSlug.WEIGHMENTS, PermissionKey.WRITE)) return forbiddenError();
  const { id } = await ctx.params;
  const weighmentId = Number(id);
  const body = await req.json();

  const parsed = editWeighmentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, StatusCodes.BAD_REQUEST);
  }

  // 1. Fetch existing weighment scoped to user's factory
  const { data: existing, error: fetchErr } = await client
    .from("weighments")
    .select("id, rate_id, type, in_entry:entries!in_entry_id!inner(center_id)")
    .eq("id", weighmentId)
    .eq("in_entry.factory_id", user.factory_id!)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr || !existing) {
    return apiError(ApiErrorMessage.WEIGHMENT_NOT_FOUND, StatusCodes.NOT_FOUND);
  }

  const allowedKeys = ["type", "rate_id"];
  const forbiddenKeys = Object.keys(body).filter((key) => !allowedKeys.includes(key));
  if (forbiddenKeys.length > 0) {
    return apiError(ApiErrorMessage.WEIGHMENT_ONLY_TYPE_RATE_EDITABLE, StatusCodes.BAD_REQUEST);
  }

  const updates: Record<string, unknown> = {};

  // 2. Validate 'type' update lock if type is NOT 'unassigned'
  if (parsed.data.type !== undefined) {
    if (
      existing.type !== WeighmentType.UNASSIGNED &&
      existing.type !== null &&
      existing.type !== undefined
    ) {
      return apiError(ApiErrorMessage.WEIGHMENT_TYPE_ALREADY_SET, StatusCodes.BAD_REQUEST);
    }
    updates["type"] = parsed.data.type;
  }

  // 3. Validate 'rate_id' update lock if rate_id is NOT null
  if (parsed.data.rate_id !== undefined) {
    if (existing.rate_id !== null && existing.rate_id !== undefined) {
      return apiError(ApiErrorMessage.WEIGHMENT_RATE_ALREADY_SET, StatusCodes.BAD_REQUEST);
    }
    if (parsed.data.rate_id !== null) {
      const { data: validRate } = await client
        .from("rates")
        .select("id, unit")
        .eq("id", parsed.data.rate_id)
        .eq("factory_id", user.factory_id!)
        .is("deleted_at", null)
        .maybeSingle();

      if (!validRate) {
        return apiError(ApiErrorMessage.WEIGHMENT_RATE_NOT_FOUND, StatusCodes.BAD_REQUEST);
      }
      updates["unit"] = validRate.unit;
    }
    updates["rate_id"] = parsed.data.rate_id;
  }

  if (Object.keys(updates).length === 0) {
    return apiError(ApiErrorMessage.WEIGHMENT_NO_VALID_FIELDS, StatusCodes.BAD_REQUEST);
  }

  updates["updated_at"] = new Date().toISOString();

  const { data: updated, error } = await client
    .from("weighments")
    .update(updates)
    .eq("id", weighmentId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error || !updated) {
    console.error("Failed to update weighment:", error);
    return apiError(ApiErrorMessage.FAILED_TO_UPDATE_WEIGHMENT, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return NextResponse.json({ data: updated });
});

export const DELETE = withAuth(
  withEntityScope(async (_req, user, client, _ctx, { entityId, factoryId }) => {
    if (!hasPermission(user, ProjectSlug.WEIGHMENTS, PermissionKey.DELETE)) return forbiddenError();

    const { deletedIds } = await deleteWeighments(client, factoryId, [entityId]);

    if (deletedIds.length === 0) {
      return apiError(ApiErrorMessage.WEIGHMENT_NOT_FOUND, StatusCodes.NOT_FOUND);
    }

    return NextResponse.json({ success: true, id: entityId });
  }),
);
