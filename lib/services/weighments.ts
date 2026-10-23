/**
 * @file lib/services/weighments.ts
 * @description Service helpers for entry sequential approval validation and weighment pairing/merging.
 */

import { supabase } from "@/db";
import { EntryStatus, EntrySource, Unit, WeighmentType, Role } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";

export async function validateSequentialApproval(
  client: typeof supabase,
  centerId: number,
  vehicleNumber: string,
  targetCreatedAt: string,
  targetEntryId: number,
  entrySource?: EntrySource | boolean | number | null,
  factoryId?: number,
): Promise<void> {
  let query = client
    .from("entries")
    .select("id, created_at, created_by, users:users!created_by(role), centers!inner(factory_id)")
    .eq("center_id", centerId)
    .eq("vehicle_number", vehicleNumber)
    .eq("status", EntryStatus.PENDING)
    .lt("created_at", targetCreatedAt)
    .neq("id", targetEntryId)
    .is("deleted_at", null);

  if (factoryId !== undefined && factoryId !== null) {
    query = query.eq("centers.factory_id", factoryId);
  }

  if (entrySource !== undefined && entrySource !== null) {
    const isDevice =
      typeof entrySource === "number"
        ? true
        : entrySource === EntrySource.DEVICE || entrySource === true;
    query = isDevice
      ? query.eq("users.role", Role.HARDWARE)
      : query.neq("users.role", Role.HARDWARE);
  }

  const { data: earlierPending, error } = await query
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error checking earlier entries:", error);
    throw new Error(ApiErrorMessage.VALIDATE_SEQUENCE_FAILED);
  }

  if (earlierPending) {
    const creator = (earlierPending as { users?: { role?: string } }).users;
    const isDevice = creator?.role === Role.HARDWARE;
    const sourceLabel = isDevice ? "device " : "manual ";
    throw new Error(
      ApiErrorMessage.CANNOT_APPROVE_PENDING_EARLIER_ENTRY(
        targetEntryId,
        earlierPending.id,
        new Date(earlierPending.created_at).toLocaleString(),
        vehicleNumber,
        sourceLabel,
      ),
    );
  }
}

export { tryMergeEntries } from "./weighments/merge";

export function formatWeighmentRecord(row: Record<string, unknown>): Record<string, unknown> {
  const inEntry = (row["in_entry"] as Record<string, unknown>) || {};
  const outEntry = (row["out_entry"] as Record<string, unknown>) || {};

  const inWeight = Number(inEntry.weight || 0);
  const outWeight = Number(outEntry.weight || 0);

  const grossWeight = Math.max(inWeight, outWeight);
  const tareWeight = Math.min(inWeight, outWeight);
  const netWeight = grossWeight - tareWeight;

  const inImages = Array.isArray(inEntry.images) ? (inEntry.images as string[]) : [];
  const outImages = Array.isArray(outEntry.images) ? (outEntry.images as string[]) : [];
  const combinedImages = Array.from(new Set([...inImages, ...outImages]));

  const inUsers = inEntry.users as Record<string, unknown> | undefined;
  const outUsers = outEntry.users as Record<string, unknown> | undefined;
  const inCustomers = inEntry.customers as Record<string, unknown> | undefined;
  const outCustomers = outEntry.customers as Record<string, unknown> | undefined;

  return {
    id: row.id,
    unit: row.unit || Unit.KG,
    type: row.type || WeighmentType.UNASSIGNED,
    rate_id: (row.rate_id as number | undefined) ?? null,
    gross_weight: grossWeight,
    tare_weight: tareWeight,
    net_weight: netWeight,
    images: combinedImages,
    in_entry_id: row.in_entry_id,
    in_entry_created_at: inEntry.created_at,
    out_entry_id: row.out_entry_id,
    out_entry_created_at: outEntry.created_at,
    in_center_id: (inEntry.center_id as number | undefined) ?? null,
    in_center_name: (inEntry.centers as { name?: string } | undefined)?.name ?? "",
    out_center_id: (outEntry.center_id as number | undefined) ?? null,
    out_center_name: (outEntry.centers as { name?: string } | undefined)?.name ?? "",
    in_user_id: inEntry.created_by ?? inEntry.user_id ?? null,
    in_user_name: inUsers?.name || "",
    out_user_id: outEntry.created_by ?? outEntry.user_id ?? null,
    out_user_name: outUsers?.name || "",
    in_customer_id: (inEntry.customer_id as number | undefined) ?? null,
    in_customer_name: inCustomers?.name || "",
    out_customer_id: (outEntry.customer_id as number | undefined) ?? null,
    out_customer_name: outCustomers?.name || "",
    vehicle_number: inEntry.vehicle_number || outEntry.vehicle_number || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function deleteWeighments(
  client: typeof supabase,
  factoryId: number,
  weighmentIds: number[],
): Promise<{ deletedIds: number[]; cascadedEntryIds: number[] }> {
  if (!weighmentIds || weighmentIds.length === 0) {
    return { deletedIds: [], cascadedEntryIds: [] };
  }

  // 1. Fetch weighments with factory verification
  const { data: weighments, error: fetchErr } = await client
    .from("weighments")
    .select(
      `id, in_entry_id, out_entry_id, in_entry:entries!in_entry_id!inner(centers!inner(factory_id))`,
    )
    .in("id", weighmentIds)
    .is("deleted_at", null);

  if (fetchErr) {
    console.error("Failed to fetch weighments for deletion:", fetchErr);
    throw new Error("Failed to delete weighments");
  }

  const validWeighments = (weighments || []).filter(
    (w: Record<string, unknown>) =>
      (w["in_entry"] as { centers?: { factory_id?: number } } | undefined)?.centers?.factory_id ===
      factoryId,
  );

  if (validWeighments.length === 0) {
    return { deletedIds: [], cascadedEntryIds: [] };
  }

  const now = new Date().toISOString();
  const validIds = validWeighments.map((w) => w.id as number);

  // 2. Soft delete the weighment record(s)
  const { error: deleteErr } = await client
    .from("weighments")
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .in("id", validIds)
    .is("deleted_at", null);

  if (deleteErr) {
    console.error("Failed to soft delete weighments:", deleteErr);
    throw new Error("Failed to delete weighments");
  }

  // 3. Cascade soft delete to corresponding in_entry and out_entry
  const cascadedEntryIds = [
    ...new Set(
      validWeighments
        .flatMap((w) => [w.in_entry_id as number, w.out_entry_id as number])
        .filter((id): id is number => typeof id === "number" && id > 0),
    ),
  ];

  if (cascadedEntryIds.length > 0) {
    const { error: cascadeErr } = await client
      .from("entries")
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .in("id", cascadedEntryIds)
      .is("deleted_at", null);

    if (cascadeErr) {
      console.error("Failed to cascade soft delete to linked entries:", cascadeErr);
    }
  }

  return { deletedIds: validIds, cascadedEntryIds };
}
