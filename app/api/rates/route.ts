import { NextResponse } from "next/server";
import {
  withAuth,
  getPaginationParams,
  apiError,
  forbiddenError,
  hasPermission,
  StatusCodes,
  formatEntityResponse,
  parseBulkIds,
  isUniqueConstraintError,
} from "@/db/helpers";
import { ProjectSlug, PermissionKey } from "@/lib/constants/enums";
import { sanitizeSearchTerm } from "@/lib/services/common";
import { ApiErrorMessage } from "@/lib/constants/messages";
import { addRateSchema } from "@/lib/validation";

export const GET = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.RATES, PermissionKey.READ)) return forbiddenError();
  const pagination = getPaginationParams(req.nextUrl);
  const search = req.nextUrl.searchParams.get("search");
  const sortColumn = req.nextUrl.searchParams.get("sort_column") || "created_at";
  const sortDesc = req.nextUrl.searchParams.has("sort_desc")
    ? req.nextUrl.searchParams.get("sort_desc") === "true"
    : true;
  const commodityIdParam = req.nextUrl.searchParams.get("commodity_id");
  const unitParam = req.nextUrl.searchParams.get("unit");
  const startDateParam = req.nextUrl.searchParams.get("start_date");
  const endDateParam = req.nextUrl.searchParams.get("end_date");

  let query = client
    .from("rates")
    .select(`*, commodities!left(name)`, { count: "exact" })
    .order(sortColumn, { ascending: !sortDesc })
    .eq("factory_id", user.factory_id!)
    .is("deleted_at", null);

  if (commodityIdParam && commodityIdParam !== "all") {
    query = query.eq("commodity_id", Number(commodityIdParam));
  }
  if (unitParam && unitParam !== "all") {
    query = query.eq("unit", unitParam);
  }
  if (startDateParam) {
    query = query.gte("created_at", startDateParam);
  }
  if (endDateParam) {
    query = query.lte("created_at", endDateParam);
  }

  if (search) {
    const cleanSearch = sanitizeSearchTerm(search);
    if (cleanSearch) {
      const searchNum = parseInt(cleanSearch, 10);
      if (!isNaN(searchNum)) {
        query = query.or(
          `id.eq.${searchNum},unit_price::text.ilike.%${cleanSearch}%,commodities.name.ilike.%${cleanSearch}%`,
        );
      } else {
        query = query.or(
          `unit_price::text.ilike.%${cleanSearch}%,commodities.name.ilike.%${cleanSearch}%`,
        );
      }
    }
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
    const commodities = row.commodities as Record<string, unknown> | undefined;
    return {
      ...row,
      commodity_name: commodities?.name || "",
    };
  });

  const total = count ?? formattedData.length;
  return NextResponse.json({
    data: formattedData,
    pagination: { page, limit, total },
  });
});

export const POST = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.RATES, PermissionKey.CREATE)) return forbiddenError();
  const body = await req.json();
  const parsed = addRateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, StatusCodes.BAD_REQUEST);
  }

  const { commodity_id, unit_price, unit } = parsed.data;
  const insertValues: Record<string, unknown> = {
    commodity_id: Number(commodity_id),
    unit_price: String(unit_price),
    unit,
    factory_id: user.factory_id,
  };

  const { data: newRate, error } = await client
    .from("rates")
    .insert(insertValues)
    .select()
    .single();

  if (error) {
    console.error("POST rate error:", error);
    if (isUniqueConstraintError(error)) {
      return apiError(ApiErrorMessage.RATE_EXISTS, StatusCodes.CONFLICT);
    }
    return apiError(error.message || ApiErrorMessage.CREATE_RATE_FAILED, StatusCodes.BAD_REQUEST);
  }

  return formatEntityResponse(newRate, StatusCodes.CREATED);
});

export const DELETE = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.RATES, PermissionKey.DELETE)) return forbiddenError();
  const ids = parseBulkIds(await req.json());
  if (!ids) return apiError(ApiErrorMessage.PROVIDE_VALID_IDS, StatusCodes.BAD_REQUEST);

  // Check if any active weighments are linked to any of the selected rates
  const { data: linkedWeighments } = await client
    .from("weighments")
    .select("id")
    .in("rate_id", ids)
    .is("deleted_at", null)
    .limit(1);

  if (linkedWeighments && linkedWeighments.length > 0) {
    return apiError(ApiErrorMessage.CANNOT_DELETE_SELECTED_RATES, StatusCodes.BAD_REQUEST);
  }

  const query = client
    .from("rates")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .is("deleted_at", null)
    .eq("factory_id", user.factory_id);

  const { data, error } = await query.select("id");
  if (error) {
    return apiError(
      error.message || ApiErrorMessage.CANNOT_DELETE_SELECTED_RATES,
      StatusCodes.BAD_REQUEST,
    );
  }

  if (!data || data.length !== ids.length) {
    return apiError(ApiErrorMessage.ONE_OR_MORE_RATES_NOT_FOUND, StatusCodes.NOT_FOUND);
  }

  return NextResponse.json({ success: true, deleted_count: data.length });
});
