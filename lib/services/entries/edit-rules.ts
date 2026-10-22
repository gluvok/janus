/**
 * @file lib/services/entries/edit-rules.ts
 * @description Domain validation and update rule builder for modifying existing entries.
 */

import { supabase } from "@/db";
import { StatusCodes } from "@/db/helpers";
import { EntrySource, EntryStatus, Role } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";
import {
  validateCenterBelongsToFactory,
  validateCustomerBelongsToFactory,
} from "@/lib/services/entries";

export interface EditEntryValidationResult {
  updates?: Record<string, unknown>;
  error?: {
    message: string;
    status: StatusCodes;
  };
}

export async function validateAndBuildEntryUpdates(
  client: typeof supabase,
  existing: Record<string, unknown>,
  body: Record<string, unknown>,
  factoryId: number,
): Promise<EditEntryValidationResult> {
  // 1. Strict Edit Lock Matrix Verification
  if (existing.status === EntryStatus.REJECTED) {
    return {
      error: {
        message: ApiErrorMessage.ENTRY_REJECTED_LOCKED,
        status: StatusCodes.FORBIDDEN,
      },
    };
  }

  const isApproved = existing.status === EntryStatus.APPROVED || existing.auto_approved === true;
  const isAutoApproved = existing.auto_approved === true;
  const isEdited = Boolean(
    isApproved &&
    existing.detected_vehicle_number &&
    existing.vehicle_number &&
    existing.detected_vehicle_number !== existing.vehicle_number,
  );
  const hasCustomer = existing.customer_id !== null && existing.customer_id !== undefined;

  // Fully locked if:
  // - Approved (not auto-approved) AND already has customer
  // - Auto-approved AND already edited AND already has customer
  if (isApproved && hasCustomer && (!isAutoApproved || isEdited)) {
    return {
      error: {
        message: ApiErrorMessage.ENTRY_FULLY_LOCKED,
        status: StatusCodes.FORBIDDEN,
      },
    };
  }

  const updates: Record<string, unknown> = {};

  if (isApproved) {
    // 1. Vehicle number check: ONLY auto-approved entries that have NOT been edited can correct vehicle_number
    if (body.vehicle_number !== undefined && body.vehicle_number !== existing.vehicle_number) {
      if (!isAutoApproved) {
        return {
          error: {
            message: ApiErrorMessage.CANNOT_MODIFY_MANUALLY_APPROVED_VEHICLE,
            status: StatusCodes.BAD_REQUEST,
          },
        };
      }
      if (isEdited) {
        return {
          error: {
            message: ApiErrorMessage.VEHICLE_ALREADY_EDITED_LOCKED,
            status: StatusCodes.BAD_REQUEST,
          },
        };
      }
      updates["vehicle_number"] = body.vehicle_number;
    }

    // 2. Customer ID check: only if customer is currently null
    if (body.customer_id !== undefined && body.customer_id !== existing.customer_id) {
      if (hasCustomer) {
        return {
          error: {
            message: ApiErrorMessage.ENTRY_APPROVED_CUSTOMER_LOCKED,
            status: StatusCodes.BAD_REQUEST,
          },
        };
      }
      if (body.customer_id) {
        await validateCustomerBelongsToFactory(client, Number(body.customer_id), factoryId);
      }
      updates["customer_id"] = body.customer_id ? Number(body.customer_id) : null;
    }

    // 3. Locked fields check (weight, center_id, images, status cannot be modified on approved)
    const lockedFields = ["weight", "center_id", "images", "status"] as const;
    for (const field of lockedFields) {
      if (body[field] !== undefined && body[field] !== existing[field]) {
        return {
          error: {
            message: ApiErrorMessage.CANNOT_MODIFY_APPROVED_ENTRY(
              field === "center_id" ? "center" : field,
            ),
            status: StatusCodes.BAD_REQUEST,
          },
        };
      }
    }
  } else if (existing.status === EntryStatus.PENDING) {
    const creatorRole =
      (existing.created_by_user as { role?: string } | undefined)?.role ||
      (existing.creator as { role?: string } | undefined)?.role;
    const isDevice =
      creatorRole === Role.HARDWARE ||
      existing.source === EntrySource.DEVICE ||
      (existing.device_id !== null && existing.device_id !== undefined);
    const isManual = !isDevice;
    if (isManual) {
      // Manual Pending: allow vehicle_number, weight, center_id, customer_id, images, status
      if (body.vehicle_number !== undefined) updates["vehicle_number"] = body.vehicle_number;
      if (body.weight !== undefined) updates["weight"] = Number(body.weight);
      if (body.images !== undefined) updates["images"] = body.images;
      if (body.status !== undefined) updates["status"] = body.status;

      if (body.center_id !== undefined) {
        await validateCenterBelongsToFactory(client, Number(body.center_id), factoryId);
        updates["center_id"] = Number(body.center_id);
      }
      if (body.customer_id !== undefined) {
        if (body.customer_id) {
          await validateCustomerBelongsToFactory(client, Number(body.customer_id), factoryId);
        }
        updates["customer_id"] = body.customer_id ? Number(body.customer_id) : null;
      }
    } else {
      // Device Pending (not auto-approved): allow vehicle_number, status
      const lockedDeviceFields = ["weight", "center_id", "images", "customer_id"] as const;
      for (const field of lockedDeviceFields) {
        if (body[field] !== undefined && body[field] !== existing[field]) {
          return {
            error: {
              message: ApiErrorMessage.CANNOT_MODIFY_DEVICE_FIELD(
                field === "center_id" ? "center" : field,
              ),
              status: StatusCodes.BAD_REQUEST,
            },
          };
        }
      }
      if (body.vehicle_number !== undefined) updates["vehicle_number"] = body.vehicle_number;
      if (body.status !== undefined) updates["status"] = body.status;
    }
  }

  return { updates };
}

export async function handleVehicleChangeSync(
  client: typeof supabase,
  factoryId: number,
  entryId: number,
  newVehicleNumber: unknown,
  updateWeighmentPair: boolean,
): Promise<number | null> {
  let unlinkedPartnerId: number | null = null;

  const { data: linkedWeighment } = await client
    .from("weighments")
    .select("id, in_entry_id, out_entry_id")
    .or(`in_entry_id.eq.${entryId},out_entry_id.eq.${entryId}`)
    .is("deleted_at", null)
    .maybeSingle();

  if (linkedWeighment) {
    const partnerEntryId =
      linkedWeighment.in_entry_id === entryId
        ? linkedWeighment.out_entry_id
        : linkedWeighment.in_entry_id;

    if (updateWeighmentPair) {
      await client
        .from("entries")
        .update({
          vehicle_number: newVehicleNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("id", partnerEntryId);
    } else {
      const { data: partnerEntry } = await client
        .from("entries")
        .select("id, vehicle_number")
        .eq("id", partnerEntryId)
        .maybeSingle();

      if (partnerEntry && newVehicleNumber !== partnerEntry.vehicle_number) {
        await client.from("weighments").delete().eq("id", linkedWeighment.id);
        unlinkedPartnerId = partnerEntryId;
      }
    }
  }

  return unlinkedPartnerId;
}
