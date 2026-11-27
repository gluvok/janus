/**
 * @file lib/services/entries.ts
 * @description Service helpers for entry creation, validation, and processing.
 */

import { supabase } from "@/db";
import { EntryStatus } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";
import { uploadBase64ImagesToStorage, deleteStorageImages } from "./storage";

export interface CreateEntryParams {
  factoryId: number;
  centerId: number;
  vehicleNumber: string;
  weight: number;
  createdBy?: number;
  approvedBy?: number | null;
  deviceId?: number | null;
  userId?: number | null;
  detectedVehicleNumber?: string | null;
  customerId?: number | null;
  status?: EntryStatus;
  images?: string[];
  idempotencyKey?: string | null;
}

export async function validateCenterBelongsToFactory(
  client: typeof supabase,
  centerId: number,
  factoryId: number,
): Promise<{ id: number; auto_approve: boolean }> {
  const { data: centerRecord } = await client
    .from("centers")
    .select("id, auto_approve")
    .eq("id", centerId)
    .eq("factory_id", factoryId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!centerRecord) {
    throw new Error(ApiErrorMessage.SELECTED_CENTER_NOT_FOUND);
  }

  return {
    id: centerRecord.id,
    auto_approve: Boolean(centerRecord.auto_approve),
  };
}

export async function validateCustomerBelongsToFactory(
  client: typeof supabase,
  customerId: number,
  factoryId: number,
): Promise<void> {
  const { data: customerRecord } = await client
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("factory_id", factoryId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!customerRecord) {
    throw new Error(ApiErrorMessage.CUSTOMER_NOT_FOUND);
  }
}

export async function createEntry(client: typeof supabase, params: CreateEntryParams) {
  const {
    factoryId,
    centerId,
    vehicleNumber,
    weight,
    createdBy,
    approvedBy: explicitApprovedBy = null,
    deviceId = null,
    userId = null,
    detectedVehicleNumber = null,
    customerId = null,
    status = EntryStatus.PENDING,
    images = [],
    idempotencyKey = null,
  } = params;

  const creatorId = createdBy ?? userId ?? deviceId;
  if (!creatorId) {
    throw new Error("Missing created_by user ID");
  }

  const uploadedImageUrls = await uploadBase64ImagesToStorage(images, factoryId);

  // Validation, approval, insert and weighment merge run atomically inside the RPC.
  const { data, error } = await client.rpc("create_entry_with_weighment", {
    p_factory_id: factoryId,
    p_center_id: centerId,
    p_created_by: creatorId,
    p_vehicle_number: vehicleNumber,
    p_weight: weight,
    p_detected_vehicle_number: detectedVehicleNumber,
    p_customer_id: customerId,
    p_status: status,
    p_approved_by: explicitApprovedBy,
    p_images: uploadedImageUrls,
    p_idempotency_key: idempotencyKey,
  });

  // P0001 carries an ApiErrorMessage raised by the RPC; anything else must not reach clients.
  if (error?.code === "P0001") throw new Error(error.message);
  if (error || !data?.entry) {
    console.error("Failed to create entry:", error ?? data);
    throw new Error(ApiErrorMessage.CREATE_ENTRY_FAILED);
  }

  return { ...data.entry, source: data.source, replayed: data.replayed };
}

export async function deleteEntries(
  client: typeof supabase,
  factoryId: number,
  entryIds: number[],
): Promise<{ deletedIds: number[] }> {
  if (!entryIds || entryIds.length === 0) {
    return { deletedIds: [] };
  }

  // 1. Check if any active weighments are linked to these entries
  const { data: linkedWeighments } = await client
    .from("weighments")
    .select("id")
    .or(`in_entry_id.in.(${entryIds.join(",")}),out_entry_id.in.(${entryIds.join(",")})`)
    .is("deleted_at", null)
    .limit(1);

  if (linkedWeighments && linkedWeighments.length > 0) {
    if (entryIds.length === 1) {
      throw new Error(ApiErrorMessage.CANNOT_DELETE_ENTRY(entryIds[0]));
    }
    throw new Error(ApiErrorMessage.CANNOT_DELETE_SELECTED_ENTRIES);
  }

  // 2. Validate that entries belong to centers associated with this factory
  const { data: validEntries } = await client
    .from("entries")
    .select("id, centers!inner(factory_id)")
    .in("id", entryIds)
    .eq("centers.factory_id", factoryId)
    .is("deleted_at", null);

  const validIds = (validEntries || []).map((e: { id: number }) => e.id);
  if (validIds.length === 0) {
    return { deletedIds: [] };
  }

  const now = new Date().toISOString();
  const { data: deletedEntries, error } = await client
    .from("entries")
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .in("id", validIds)
    .is("deleted_at", null)
    .select("id, images");

  if (error) {
    console.error("Failed to soft delete entries:", error);
    const msg =
      entryIds.length === 1
        ? error.message || ApiErrorMessage.CANNOT_DELETE_ENTRY(entryIds[0])
        : error.message || ApiErrorMessage.CANNOT_DELETE_SELECTED_ENTRIES;
    throw new Error(msg);
  }

  const deletedIds = (deletedEntries || []).map((e: { id: number }) => e.id);
  const imagesToPurge: string[] = [];
  (deletedEntries || []).forEach((e: { images?: string[] }) => {
    if (Array.isArray(e.images)) imagesToPurge.push(...e.images);
  });
  if (imagesToPurge.length > 0) {
    try {
      await deleteStorageImages(imagesToPurge, factoryId);
    } catch (storageErr) {
      console.error("Failed to delete storage images on entries deletion:", storageErr);
    }
  }

  return { deletedIds };
}
