import { NextResponse } from "next/server";
import {
  withAuth,
  withEntityScope,
  apiError,
  forbiddenError,
  hasPermission,
  StatusCodes,
} from "@/db/helpers";
import { ProjectSlug, PermissionKey, EntryStatus, EntrySource, Role } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";
import { validateSequentialApproval, tryMergeEntries } from "@/lib/services/weighments";
import { deleteEntries } from "@/lib/services/entries";
import {
  validateAndBuildEntryUpdates,
  handleVehicleChangeSync,
} from "@/lib/services/entries/edit-rules";
import { editEntrySchema, indianPlateSchema, isNoPlateDetectedText } from "@/lib/validation";

export const GET = withAuth<{ id: string }>(async (_req, user, client, ctx) => {
  if (!hasPermission(user, ProjectSlug.ENTRIES, PermissionKey.READ)) return forbiddenError();
  const { id } = await ctx.params;
  const entryId = Number(id);

  const [{ data, error }, { data: linkedWeighment }] = await Promise.all([
    client
      .from("entries")
      .select(
        `*, centers!inner(name, factory_id), created_by_user:users!created_by(name, role), approved_by_user:users!approved_by(name, role), customers(name, user_id)`,
      )
      .eq("id", entryId)
      .eq("centers.factory_id", user.factory_id!)
      .is("deleted_at", null)
      .maybeSingle(),
    client
      .from("weighments")
      .select("id, in_entry_id, out_entry_id")
      .or(`in_entry_id.eq.${entryId},out_entry_id.eq.${entryId}`)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (error || !data) {
    return apiError(ApiErrorMessage.ENTRY_NOT_FOUND, StatusCodes.NOT_FOUND);
  }

  if (user.role === Role.BASE) {
    const userId = parseInt(user.sub, 10);
    const customer = data.customers as { user_id?: number } | undefined;
    if (customer?.user_id !== userId) {
      return apiError(ApiErrorMessage.ENTRY_NOT_FOUND, StatusCodes.NOT_FOUND);
    }
  }

  const isApproved = data.status === EntryStatus.APPROVED || data.auto_approved === true;
  const isEdited = Boolean(
    isApproved &&
    data.detected_vehicle_number &&
    data.vehicle_number &&
    data.detected_vehicle_number !== data.vehicle_number,
  );

  const centers = data.centers as Record<string, unknown> | undefined;
  const createdByUser = data.created_by_user as Record<string, unknown> | undefined;
  const approvedByUser = data.approved_by_user as Record<string, unknown> | undefined;
  const customers = data.customers as Record<string, unknown> | undefined;
  const isHardware = createdByUser?.role === Role.HARDWARE;

  const weighmentInfo = linkedWeighment
    ? {
        id: linkedWeighment.id,
        partner_entry_id:
          linkedWeighment.in_entry_id === entryId
            ? linkedWeighment.out_entry_id
            : linkedWeighment.in_entry_id,
      }
    : null;

  const formatted = {
    ...data,
    source: isHardware ? EntrySource.DEVICE : EntrySource.MANUAL,
    edited: isEdited,
    center_name: centers?.name || "",
    created_by_name: createdByUser?.name || "",
    approved_by_name: approvedByUser?.name || "",
    user_id: data.created_by ?? (data.user_id as number | undefined) ?? null,
    user_name: createdByUser?.name || "",
    customer_name: customers?.name || "",
    linked_weighment: weighmentInfo,
  };

  return NextResponse.json({ data: formatted });
});

import { uploadFilesToStorage, deleteStorageImages } from "@/lib/services/storage";

export const PATCH = withAuth<{ id: string }>(async (req, user, client, ctx) => {
  if (!hasPermission(user, ProjectSlug.ENTRIES, PermissionKey.WRITE)) return forbiddenError();
  const { id } = await ctx.params;
  const entryId = Number(id);

  const contentType = req.headers.get("content-type") || "";
  let body: Record<string, unknown> = {};
  const files: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    formData.forEach((value, key) => {
      if (key === "files" || key === "file" || key === "images" || key === "image") {
        if (value instanceof File && value.size > 0) {
          files.push(value);
        }
      } else {
        body[key] = value;
      }
    });

    const existingUrls: string[] = [];
    for (const key of ["image_urls", "images"]) {
      for (const entry of formData.getAll(key)) {
        if (
          typeof entry === "string" &&
          (entry.startsWith("http://") || entry.startsWith("https://"))
        ) {
          existingUrls.push(entry);
        }
      }
    }

    if (
      files.length > 0 ||
      existingUrls.length > 0 ||
      formData.has("images") ||
      formData.has("image_urls")
    ) {
      body.images = existingUrls;
    }
  } else {
    body = await req.json();
  }

  // If new files are attached, upload them to Supabase storage
  if (files.length > 0) {
    const uploadedUrls = await uploadFilesToStorage(files, user.factory_id!);
    const currentImages = Array.isArray(body.images) ? (body.images as string[]) : [];
    body.images = [...currentImages, ...uploadedUrls];
  }

  const parsed = editEntrySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, StatusCodes.BAD_REQUEST);
  }

  // 1. Fetch current entry
  const { data: existing, error: fetchErr } = await client
    .from("entries")
    .select("*, centers!inner(factory_id), created_by_user:users!created_by(role)")
    .eq("id", entryId)
    .eq("centers.factory_id", user.factory_id!)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr || !existing) {
    return apiError(ApiErrorMessage.ENTRY_NOT_FOUND, StatusCodes.NOT_FOUND);
  }

  // If images are being updated, remove deleted images from storage
  if (body.images !== undefined && Array.isArray(existing.images)) {
    const remainingImages = (body.images || []) as string[];
    const removedImages = (existing.images as string[]).filter(
      (img) => !remainingImages.includes(img),
    );
    if (removedImages.length > 0) {
      try {
        await deleteStorageImages(removedImages, user.factory_id!);
      } catch (err) {
        console.error("Failed to delete removed storage images on patch:", err);
      }
    }
  }

  // 2. Validate edit locks and compute updates
  const validation = await validateAndBuildEntryUpdates(client, existing, body, user.factory_id!);
  if (validation.error) {
    return apiError(validation.error.message, validation.error.status);
  }

  const updates = validation.updates || {};
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ data: existing });
  }

  const newStatus = (updates["status"] as string) || existing.status;
  const targetVehicle = (updates["vehicle_number"] as string) || existing.vehicle_number;
  let finalVehicle = targetVehicle;

  // 3. Prevent approving an entry with NO_PLATE_DETECTED or invalid vehicle number
  if (newStatus === EntryStatus.APPROVED) {
    if (isNoPlateDetectedText(targetVehicle)) {
      return apiError(ApiErrorMessage.CANNOT_APPROVE_NO_PLATE, StatusCodes.BAD_REQUEST);
    }
    const plateValidation = indianPlateSchema("Vehicle Number").safeParse(targetVehicle);
    if (!plateValidation.success) {
      return apiError(plateValidation.error.issues[0].message, StatusCodes.BAD_REQUEST);
    }
    finalVehicle = plateValidation.data;
    if (updates["vehicle_number"] !== undefined || existing.status !== EntryStatus.APPROVED) {
      updates["vehicle_number"] = finalVehicle;
    }
  }

  // 4. Sequential Approval Validation
  const isApproved = existing.status === EntryStatus.APPROVED || existing.auto_approved === true;
  const isTransitioningToApproved =
    newStatus === EntryStatus.APPROVED && existing.status !== EntryStatus.APPROVED;
  const isChangingVehicleOnApproved =
    isApproved &&
    updates["vehicle_number"] !== undefined &&
    updates["vehicle_number"] !== existing.vehicle_number;

  if (isTransitioningToApproved || isChangingVehicleOnApproved) {
    try {
      await validateSequentialApproval(
        client,
        (updates["center_id"] as number) || existing.center_id,
        finalVehicle,
        existing.created_at,
        entryId,
        undefined,
        user.factory_id!,
      );
    } catch (seqErr: unknown) {
      const msg =
        seqErr instanceof Error ? seqErr.message : ApiErrorMessage.SEQUENTIAL_APPROVAL_FAILED;
      return apiError(msg, StatusCodes.BAD_REQUEST);
    }
  }

  if (isTransitioningToApproved) {
    updates["approved_by"] = parseInt(user.sub, 10);
  }

  updates["updated_at"] = new Date().toISOString();

  // 5. Vehicle plate sync with linked weighments
  const isChangingVehicle =
    updates["vehicle_number"] !== undefined &&
    updates["vehicle_number"] !== existing.vehicle_number;
  const updateWeighmentPair = parsed.data.update_weighment_pair === true;

  let unlinkedPartnerId: number | null = null;
  if (isChangingVehicle) {
    unlinkedPartnerId = await handleVehicleChangeSync(
      client,
      user.factory_id!,
      entryId,
      updates["vehicle_number"],
      updateWeighmentPair,
    );
  }

  // 6. Execute update on current entry
  const { data: updatedEntry, error: updateErr } = await client
    .from("entries")
    .update(updates)
    .eq("id", entryId)
    .select("*")
    .single();

  if (updateErr || !updatedEntry) {
    console.error("Entry update failed:", updateErr);
    return apiError(ApiErrorMessage.FAILED_TO_UPDATE_ENTRY, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  // 7. Auto-merge trigger if transitioning to APPROVED
  if (isTransitioningToApproved) {
    await tryMergeEntries(client, user.factory_id!, entryId, {
      ...updatedEntry,
      creator: existing.created_by_user,
    });
  }
  if (unlinkedPartnerId) {
    await tryMergeEntries(client, user.factory_id!, unlinkedPartnerId);
  }

  const isApprovedUpdated =
    updatedEntry.status === EntryStatus.APPROVED || updatedEntry.auto_approved === true;
  const isEditedUpdated = Boolean(
    isApprovedUpdated &&
    updatedEntry.detected_vehicle_number &&
    updatedEntry.vehicle_number &&
    updatedEntry.detected_vehicle_number !== updatedEntry.vehicle_number,
  );

  const existingCreatedByUser = existing.created_by_user as { role?: string } | undefined;
  const isHardwareUpdated = existingCreatedByUser?.role === Role.HARDWARE;

  return NextResponse.json({
    data: {
      ...updatedEntry,
      source: isHardwareUpdated ? EntrySource.DEVICE : EntrySource.MANUAL,
      edited: isEditedUpdated,
    },
  });
});

export const DELETE = withAuth(
  withEntityScope(async (_req, user, client, _ctx, { entityId, factoryId }) => {
    if (!hasPermission(user, ProjectSlug.ENTRIES, PermissionKey.DELETE)) return forbiddenError();

    try {
      const { deletedIds } = await deleteEntries(client, factoryId, [entityId]);

      if (deletedIds.length === 0) {
        return apiError(ApiErrorMessage.ENTRY_NOT_FOUND, StatusCodes.NOT_FOUND);
      }

      return NextResponse.json({ success: true, id: entityId });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : ApiErrorMessage.CANNOT_DELETE_ENTRY(entityId);
      return apiError(msg, StatusCodes.BAD_REQUEST);
    }
  }),
);
