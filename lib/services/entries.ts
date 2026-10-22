/**
 * @file lib/services/entries.ts
 * @description Service helpers for entry creation, validation, and processing.
 */

import { supabase } from "@/db";
import { EntryStatus, EntrySource, Role } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";
import { uploadBase64ImagesToStorage, deleteStorageImages } from "./storage";
import { validateSequentialApproval, tryMergeEntries } from "./weighments";
import { isNoPlateDetectedText } from "@/lib/validation";

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
  } = params;

  const creatorId = createdBy ?? userId ?? deviceId;
  if (!creatorId) {
    throw new Error("Missing created_by user ID");
  }

  // Fetch creator's role to determine whether this entry originates from hardware
  const { data: creator } = await client
    .from("users")
    .select("id, role")
    .eq("id", creatorId)
    .is("deleted_at", null)
    .maybeSingle();

  const isDevice = creator?.role === Role.HARDWARE;
  const isNoPlate =
    isNoPlateDetectedText(vehicleNumber) || isNoPlateDetectedText(detectedVehicleNumber);

  // 1 & 2. Verify center and customer (if provided) concurrently
  // When no plate detected is received from device, skip fetching the centers table since auto-approval is impossible.
  const [centerRecord] = await Promise.all([
    isNoPlate && isDevice
      ? Promise.resolve(null)
      : validateCenterBelongsToFactory(client, Number(centerId), factoryId),
    customerId
      ? validateCustomerBelongsToFactory(client, Number(customerId), factoryId)
      : Promise.resolve(),
  ]);

  // 3. Determine auto_approved flag & final approval status
  let finalStatus = status;
  let isAutoApproved = false;
  let approvedBy = explicitApprovedBy;

  if (isDevice && !isNoPlate) {
    if (centerRecord?.auto_approve) {
      isAutoApproved = true;
      finalStatus = EntryStatus.APPROVED;
      approvedBy = creatorId;
    }
  } else {
    // Manual entries or entries with NO_PLATE_DETECTED are NEVER auto-approved
    isAutoApproved = false;
    if (finalStatus === EntryStatus.APPROVED && !approvedBy) {
      approvedBy = creatorId;
    }
  }

  const nowStr = new Date().toISOString();

  // 4. Upload base64 images to storage
  const uploadedImageUrls = await uploadBase64ImagesToStorage(images, factoryId);

  // 5. Validate sequential approval if approved
  if (finalStatus === EntryStatus.APPROVED) {
    await validateSequentialApproval(
      client,
      Number(centerId),
      vehicleNumber,
      nowStr,
      0,
      isDevice,
      factoryId,
    );
  }

  // 6. Insert new entry into database
  const { data: newEntry, error: insertErr } = await client
    .from("entries")
    .insert({
      detected_vehicle_number: detectedVehicleNumber,
      vehicle_number: vehicleNumber,
      weight: Number(weight),
      center_id: Number(centerId),
      customer_id: customerId ? Number(customerId) : null,
      created_by: creatorId,
      approved_by: approvedBy,
      status: finalStatus,
      auto_approved: isAutoApproved,
      images: uploadedImageUrls,
      created_at: nowStr,
      updated_at: nowStr,
    })
    .select("*")
    .single();

  if (insertErr || !newEntry) {
    console.error("Failed to insert entry:", insertErr);
    throw new Error(ApiErrorMessage.CREATE_ENTRY_FAILED);
  }

  // 7. Attempt automatic weighment merging if approved
  if (newEntry.status === EntryStatus.APPROVED) {
    await tryMergeEntries(client, factoryId, newEntry.id, {
      ...newEntry,
      creator: { role: creator?.role },
    });
  }

  return {
    ...newEntry,
    source: isDevice ? EntrySource.DEVICE : EntrySource.MANUAL,
  };
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
