import { type NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  getPaginationParams,
  apiError,
  StatusCodes,
  forbiddenError,
  hasPermission,
  parseBulkIds,
  getAuthUser,
} from "@/db/helpers";
import { type AuthUserPayload } from "@/types";
import { EntrySource, EntryStatus, ProjectSlug, PermissionKey, Role } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";
import { createEntry, deleteEntries } from "@/lib/services/entries";
import { uploadFilesToStorage, deleteStorageImages } from "@/lib/services/storage";
import {
  preprocessCameraFiles,
  DEFAULT_CAMERA_CROPS,
  type CameraCropConfig,
} from "@/lib/services/image-processor";
import { hasDeviceCredentials, verifyDeviceRequest } from "@/lib/auth/device";
import { supabase } from "@/db";
import { addEntrySchema, addDeviceEntrySchema } from "@/lib/validation";

export const GET = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.ENTRIES, PermissionKey.READ)) return forbiddenError();
  const pagination = getPaginationParams(req.nextUrl);
  const search = req.nextUrl.searchParams.get("search");
  const startDate = req.nextUrl.searchParams.get("start_date");
  const endDate = req.nextUrl.searchParams.get("end_date");
  const sortColumn = req.nextUrl.searchParams.get("sort_column") || "created_at";
  const sortDesc = req.nextUrl.searchParams.has("sort_desc")
    ? req.nextUrl.searchParams.get("sort_desc") === "true"
    : true;

  const selectString =
    user.role === Role.BASE
      ? `*, centers!inner(name, factory_id), created_by_user:users!created_by(name, role), approved_by_user:users!approved_by(name, role), customers!inner(name, user_id)`
      : `*, centers!inner(name, factory_id), created_by_user:users!created_by(name, role), approved_by_user:users!approved_by(name, role), customers(name)`;

  let query = client
    .from("entries")
    .select(selectString, { count: "exact" })
    .eq("centers.factory_id", user.factory_id)
    .is("deleted_at", null)
    .order(sortColumn, { ascending: !sortDesc });

  if (user.role === Role.BASE) {
    query = query.eq("customers.user_id", parseInt(user.sub, 10));
  }

  const sourceParam = req.nextUrl.searchParams.get("source");
  if (sourceParam && sourceParam !== "all") {
    if (sourceParam === EntrySource.DEVICE) {
      query = query.eq("created_by_user.role", Role.HARDWARE);
    } else if (sourceParam === EntrySource.MANUAL) {
      query = query.neq("created_by_user.role", Role.HARDWARE);
    }
  }

  const filterParams: Record<string, string | null> = {
    status: req.nextUrl.searchParams.get("status"),
    center_id: req.nextUrl.searchParams.get("center_id"),
    created_by:
      req.nextUrl.searchParams.get("created_by") || req.nextUrl.searchParams.get("user_id"),
    customer_id: req.nextUrl.searchParams.get("customer_id"),
    auto_approved: req.nextUrl.searchParams.get("auto_approved"),
  };

  for (const [key, val] of Object.entries(filterParams)) {
    if (val && val !== "all") {
      if (val === "true" || val === "false") {
        query = query.eq(key, val === "true");
      } else {
        const num = Number(val);
        query = query.eq(key, isNaN(num) ? val : num);
      }
    }
  }

  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);

  if (search) {
    const searchNum = parseInt(search, 10);
    query = isNaN(searchNum)
      ? query.ilike("vehicle_number", `%${search}%`)
      : query.or(`vehicle_number.ilike.%${search}%,id.eq.${searchNum}`);
  }

  const { page, limit, offset } = pagination;
  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    console.error("Supabase query error:", error);
    return apiError(
      error.message || ApiErrorMessage.DATABASE_QUERY_FAILED,
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  const formattedData = (data || []).map((row: Record<string, unknown>) => {
    const centers = row.centers as Record<string, unknown> | undefined;
    const createdByUser = (row.created_by_user || row.users) as Record<string, unknown> | undefined;
    const approvedByUser = row.approved_by_user as Record<string, unknown> | undefined;
    const customers = row.customers as Record<string, unknown> | undefined;

    const isHardware = createdByUser?.role === Role.HARDWARE;

    return {
      ...row,
      source: isHardware ? EntrySource.DEVICE : EntrySource.MANUAL,
      center_name: centers?.name || "",
      created_by_name: createdByUser?.name || "",
      approved_by_name: approvedByUser?.name || "",
      user_id: row.created_by ?? (row.user_id as number | undefined) ?? null,
      user_name: createdByUser?.name || "",
      customer_name: customers?.name || "",
    };
  });

  const total = count ?? formattedData.length;
  return NextResponse.json({
    data: formattedData,
    pagination: { page, limit, total },
  });
});

export async function POST(req: NextRequest, ...rest: unknown[]) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return apiError(
        "POST /api/entries requires multipart/form-data",
        StatusCodes.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const formData = await req.formData();

    let isHardware = false;
    let creatorId: number;
    let factoryId: number;

    // Direct invocation support in unit test environments
    if (rest.length >= 1 && typeof rest[0] === "object" && rest[0] !== null && "role" in rest[0]) {
      const user = rest[0] as AuthUserPayload;
      if (!hasPermission(user, ProjectSlug.ENTRIES, PermissionKey.CREATE)) {
        return forbiddenError();
      }
      isHardware = user.role === Role.HARDWARE;
      creatorId = parseInt(user.sub, 10);
      factoryId = user.factory_id!;
    } else if (hasDeviceCredentials(req, formData)) {
      const authResult = await verifyDeviceRequest(req, supabase, formData);
      if (!authResult.success || !authResult.device) {
        return apiError(
          authResult.error || ApiErrorMessage.UNAUTHORIZED_DEVICE,
          authResult.status || StatusCodes.FORBIDDEN,
        );
      }
      isHardware = true;
      creatorId = authResult.device.id;
      factoryId = authResult.device.factory_id;
    } else {
      const authUser = await getAuthUser(req);
      if (!authUser) {
        return apiError(ApiErrorMessage.UNAUTHORIZED, StatusCodes.UNAUTHORIZED);
      }
      const user = authUser.user;
      if (!hasPermission(user, ProjectSlug.ENTRIES, PermissionKey.CREATE)) {
        return forbiddenError();
      }
      isHardware = user.role === Role.HARDWARE;
      creatorId = parseInt(user.sub, 10);
      factoryId = user.factory_id!;
    }

    const centerIdRaw = formData.get("center_id");
    const centerId = centerIdRaw ? Number(centerIdRaw) : undefined;

    if (!centerId) {
      return apiError(ApiErrorMessage.SELECTED_CENTER_NOT_FOUND, StatusCodes.BAD_REQUEST);
    }

    const rawVehicleNumber = (formData.get("vehicle_number") as string) || "";
    const rawDetectedVehicleNumber = (formData.get("detected_vehicle_number") as string) || "";
    const vehicleNumber = rawVehicleNumber || rawDetectedVehicleNumber || "";
    const detectedVehicleNumber = rawDetectedVehicleNumber || (isHardware ? vehicleNumber : null);
    const weight = Number(formData.get("weight"));
    const customerIdRaw = formData.get("customer_id");
    const customerId = customerIdRaw ? Number(customerIdRaw) : null;
    const status = (formData.get("status") as EntryStatus) || EntryStatus.PENDING;

    // Extract files positionally — order is preserved by the sender (first file = cam 1, etc.)
    const files: File[] = [];
    for (const key of ["files", "file", "images", "image"]) {
      for (const entry of formData.getAll(key)) {
        if (entry instanceof File && entry.size > 0) files.push(entry);
      }
    }

    const validationData = isHardware
      ? { detected_vehicle_number: detectedVehicleNumber, weight, center_id: centerId }
      : {
          vehicle_number: vehicleNumber,
          weight,
          center_id: centerId,
          customer_id: customerId,
          status,
        };

    const parsed = isHardware
      ? addDeviceEntrySchema.safeParse(validationData)
      : addEntrySchema.safeParse(validationData);

    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, StatusCodes.BAD_REQUEST);
    }

    // Validate that the center belongs to this factory and retrieve camera_crops in one query
    const { data: centerRecord } = await supabase
      .from("centers")
      .select("id, factories(camera_crops)")
      .eq("id", centerId)
      .eq("factory_id", factoryId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!centerRecord) {
      return apiError(ApiErrorMessage.SELECTED_CENTER_NOT_FOUND, StatusCodes.BAD_REQUEST);
    }

    // Resolve camera crops from the joined factory row, fall back to defaults
    const rawCrops = (centerRecord.factories as { camera_crops?: unknown } | null)?.camera_crops;
    const cameraCrops: CameraCropConfig[] = Array.isArray(rawCrops)
      ? (rawCrops as CameraCropConfig[])
      : DEFAULT_CAMERA_CROPS;

    // Crop and upload files to Supabase Storage
    let uploadedUrls: string[] = [];
    if (files.length > 0) {
      const croppedBuffers = await preprocessCameraFiles(files, cameraCrops);
      uploadedUrls = await uploadFilesToStorage(
        croppedBuffers.map((buf, i) => {
          const ext = files[i]?.name?.split(".").pop() || "jpg";
          return new File([new Uint8Array(buf)], `cam${i + 1}.${ext}`, { type: "image/jpeg" });
        }),
        factoryId,
      );
    }

    const finalVehicleNumber = isHardware
      ? (parsed.data as { detected_vehicle_number: string }).detected_vehicle_number
      : (parsed.data as { vehicle_number: string }).vehicle_number;
    const finalDetectedVehicleNumber = isHardware
      ? (parsed.data as { detected_vehicle_number: string }).detected_vehicle_number
      : null;

    let newEntry;
    try {
      newEntry = await createEntry(supabase, {
        factoryId,
        centerId,
        createdBy: creatorId,
        vehicleNumber: finalVehicleNumber,
        detectedVehicleNumber: finalDetectedVehicleNumber,
        weight,
        customerId,
        status: isHardware ? EntryStatus.PENDING : status,
        images: uploadedUrls,
      });
    } catch (dbErr: unknown) {
      // Compensating rollback: delete uploaded images if DB insertion fails
      if (uploadedUrls.length > 0) {
        try {
          await deleteStorageImages(uploadedUrls, factoryId);
        } catch (cleanupErr) {
          console.error("Failed to cleanup uploaded images on DB failure:", cleanupErr);
        }
      }
      const msg = dbErr instanceof Error ? dbErr.message : ApiErrorMessage.PROCESS_ENTRY_FAILED;
      return apiError(msg, StatusCodes.BAD_REQUEST);
    }

    return NextResponse.json({ data: newEntry }, { status: StatusCodes.CREATED });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ApiErrorMessage.PROCESS_ENTRY_FAILED;
    return apiError(msg, StatusCodes.BAD_REQUEST);
  }
}

export const DELETE = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.ENTRIES, PermissionKey.DELETE)) return forbiddenError();

  const ids = parseBulkIds(await req.json());
  if (!ids) return apiError(ApiErrorMessage.PROVIDE_VALID_IDS, StatusCodes.BAD_REQUEST);

  try {
    const { deletedIds } = await deleteEntries(client, user.factory_id!, ids);

    if (deletedIds.length !== ids.length) {
      return apiError(ApiErrorMessage.ONE_OR_MORE_ENTRIES_NOT_FOUND, StatusCodes.NOT_FOUND);
    }

    return NextResponse.json({ success: true, deleted_count: deletedIds.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ApiErrorMessage.CANNOT_DELETE_SELECTED_ENTRIES;
    return apiError(msg, StatusCodes.BAD_REQUEST);
  }
});
