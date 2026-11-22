/**
 * @file lib/weighments-query.ts
 * @description Dedicated backend query utilities for automatic and manual weighments.
 * Executes paginated queries directly against automatic_weighments and manual_weighments with PostgreSQL stored generated columns.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import {
  automaticWeighmentTypeSchema,
  completeWeighmentTypeSchema,
  type AutomaticWeighment,
  type ManualWeighment,
} from "@/app/weighments/types";

export const ALLOWED_WEIGHMENT_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "gross",
  "tare",
  "net",
  "in_weight",
  "out_weight",
  "in_time",
  "out_time",
  "created_at",
  "updated_at",
] as const;

export type WeighmentSortColumn = (typeof ALLOWED_WEIGHMENT_SORT_COLUMNS)[number];

export const AUTOMATIC_PROJECTION = `
  id,
  in_idempotency_key,
  out_idempotency_key,
  vehicle_number,
  in_detected_vehicle_number,
  out_detected_vehicle_number,
  in_weight,
  out_weight,
  in_time,
  out_time,
  in_center_id,
  out_center_id,
  in_images,
  out_images,
  images,
  gross,
  tare,
  net,
  type,
  created_at,
  updated_at,
  in_center:centers!in_center_id!inner(id, name, factory_id),
  out_center:centers!out_center_id(id, name)
` as const;

export const MANUAL_PROJECTION = `
  id,
  vehicle_number,
  in_weight,
  out_weight,
  in_time,
  out_time,
  in_center_id,
  out_center_id,
  creator_id,
  in_images,
  out_images,
  images,
  gross,
  tare,
  net,
  type,
  created_at,
  updated_at,
  in_center:centers!in_center_id!inner(id, name, factory_id),
  out_center:centers!out_center_id(id, name),
  creator:users!creator_id(id, name, username, role)
` as const;

const commaSeparatedIdsSchema = z
  .string()
  .transform((val) =>
    val
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0),
  )
  .pipe(z.array(z.number().int().positive()));

export async function fetchCenterSearchExtraOrConditions(
  search: string | null | undefined,
): Promise<string[]> {
  if (!search) return [];

  const { data: matchedCenters } = await supabase
    .from("centers")
    .select("id")
    .ilike("name", `%${search}%`)
    .limit(100);

  if (!matchedCenters || matchedCenters.length === 0) return [];

  const ids = matchedCenters.map((c) => c.id).join(",");
  return [`in_center_id.in.(${ids})`, `out_center_id.in.(${ids})`];
}

export function applyCommonWeighmentFilters(query: any, searchParams: URLSearchParams): any {
  let filteredQuery = query;

  // Filter by single weighment id if explicitly provided
  const idParam = searchParams.get("id")?.trim();
  if (idParam) {
    const parsedId = Number(idParam);
    if (!Number.isNaN(parsedId) && parsedId > 0) {
      filteredQuery = filteredQuery.eq("id", parsedId);
    }
  }

  // Filter by in_center_id and out_center_id
  const centerFilters: readonly { param: string; column: string }[] = [
    { param: "in_center_id", column: "in_center_id" },
    { param: "out_center_id", column: "out_center_id" },
  ];

  for (const { param, column } of centerFilters) {
    const paramVal = searchParams.get(param)?.trim();
    if (paramVal && paramVal !== "all") {
      const parsed = commaSeparatedIdsSchema.safeParse(paramVal);
      if (parsed.success && parsed.data.length > 0) {
        filteredQuery = filteredQuery.in(column, parsed.data);
      }
    }
  }

  // Filter by combined centers (in_center or out_center)
  const centerParam = searchParams.get("center_ids") || searchParams.get("center_id");
  if (centerParam && centerParam !== "all") {
    const parsedIds = commaSeparatedIdsSchema.safeParse(centerParam);
    if (parsedIds.success && parsedIds.data.length > 0) {
      if (parsedIds.data.length === 1) {
        const id = parsedIds.data[0];
        filteredQuery = filteredQuery.or(`in_center_id.eq.${id},out_center_id.eq.${id}`);
      } else {
        const idList = `(${parsedIds.data.join(",")})`;
        filteredQuery = filteredQuery.or(`in_center_id.in.${idList},out_center_id.in.${idList}`);
      }
    }
  }

  return filteredQuery;
}

interface WeighmentsQueryConfig {
  request: Request;
  table: string;
  select: string;
  typeSchema: z.ZodType<string>;
}

async function executeWeighmentsQuery<TRecord extends Record<string, unknown>>({
  request,
  table,
  select,
  typeSchema,
}: WeighmentsQueryConfig): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const extraOrConditions = await fetchCenterSearchExtraOrConditions(search);

  return executePaginatedEntityQuery<WeighmentSortColumn, TRecord>({
    request,
    table,
    select,
    allowedSortColumns: ALLOWED_WEIGHMENT_SORT_COLUMNS,
    defaultSort: { col: "updated_at", ascending: false },
    searchColumns: ["vehicle_number"],
    integerColumns: ["id"],
    numericColumns: ["net", "gross", "tare", "in_weight", "out_weight"],
    extraOrConditions,
    applyCustomFilters: (query, params) => {
      let filtered = applyCommonWeighmentFilters(query, params);

      const typeParam = params.get("type")?.trim();
      if (typeParam && typeParam !== "all") {
        const parsedType = typeSchema.safeParse(typeParam);
        if (parsedType.success) {
          filtered = filtered.eq("type", parsedType.data);
        }
      }

      return filtered;
    },
  });
}

export async function executeAutomaticWeighmentsQuery(request: Request): Promise<NextResponse> {
  return executeWeighmentsQuery<AutomaticWeighment>({
    request,
    table: "automatic_weighments",
    select: AUTOMATIC_PROJECTION,
    typeSchema: automaticWeighmentTypeSchema,
  });
}

export async function executeManualWeighmentsQuery(request: Request): Promise<NextResponse> {
  return executeWeighmentsQuery<ManualWeighment>({
    request,
    table: "manual_weighments",
    select: MANUAL_PROJECTION,
    typeSchema: completeWeighmentTypeSchema,
  });
}
