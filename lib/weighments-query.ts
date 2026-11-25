/**
 * @file lib/weighments-query.ts
 * @description Dedicated backend query utilities for automatic and manual weighments views.
 */

import { NextResponse } from "next/server";
import {
  executePaginatedEntityQuery,
  commaSeparatedIdsSchema,
  applyCommaSeparatedIdFilter,
} from "@/lib/api-query";
import {
  weighmentTypeSchema,
  AUTOMATIC_WEIGHMENT_SELECT_PROJECTION,
  MANUAL_WEIGHMENT_SELECT_PROJECTION,
  type AutomaticWeighment,
  type ManualWeighment,
} from "@/app/weighments/types";

export const ALLOWED_AUTOMATIC_WEIGHMENT_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "gross",
  "tare",
  "net",
  "type",
  "in_entry_id",
  "out_entry_id",
  "in_center_id",
  "in_center_name",
  "out_center_id",
  "out_center_name",
  "in_time",
  "out_time",
  "created_at",
  "updated_at",
] as const;

export type AutomaticWeighmentSortColumn =
  (typeof ALLOWED_AUTOMATIC_WEIGHMENT_SORT_COLUMNS)[number];

export const ALLOWED_MANUAL_WEIGHMENT_SORT_COLUMNS = [
  ...ALLOWED_AUTOMATIC_WEIGHMENT_SORT_COLUMNS,
  "in_creator_id",
  "in_creator_name",
  "in_creator_username",
  "out_creator_id",
  "out_creator_name",
  "out_creator_username",
] as const;

export type ManualWeighmentSortColumn = (typeof ALLOWED_MANUAL_WEIGHMENT_SORT_COLUMNS)[number];

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
  filteredQuery = applyCommaSeparatedIdFilter(
    filteredQuery,
    searchParams.get("in_center_id"),
    "in_center_id",
  );
  filteredQuery = applyCommaSeparatedIdFilter(
    filteredQuery,
    searchParams.get("out_center_id"),
    "out_center_id",
  );

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

  // Filter by type ('in' | 'out' | 'void')
  const typeParam = searchParams.get("type")?.trim();
  if (typeParam && typeParam !== "all") {
    const parsedType = weighmentTypeSchema.safeParse(typeParam);
    if (parsedType.success) {
      filteredQuery = filteredQuery.eq("type", parsedType.data);
    }
  }

  return filteredQuery;
}

export function applyManualWeighmentFilters(query: any, searchParams: URLSearchParams): any {
  let filteredQuery = applyCommonWeighmentFilters(query, searchParams);
  filteredQuery = applyCommaSeparatedIdFilter(
    filteredQuery,
    searchParams.get("in_creator_id"),
    "in_creator_id",
  );
  filteredQuery = applyCommaSeparatedIdFilter(
    filteredQuery,
    searchParams.get("out_creator_id"),
    "out_creator_id",
  );
  return filteredQuery;
}

export async function executeAutomaticWeighmentsQuery(request: Request): Promise<NextResponse> {
  return executePaginatedEntityQuery<AutomaticWeighmentSortColumn, AutomaticWeighment>({
    request,
    table: "automatic_weighments_view",
    select: AUTOMATIC_WEIGHMENT_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_AUTOMATIC_WEIGHMENT_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["vehicle_number", "in_center_name", "out_center_name"],
    integerColumns: ["id", "in_entry_id", "out_entry_id", "in_center_id", "out_center_id"],
    numericColumns: ["net", "gross", "tare"],
    applyCustomFilters: applyCommonWeighmentFilters,
  });
}

export async function executeManualWeighmentsQuery(request: Request): Promise<NextResponse> {
  return executePaginatedEntityQuery<ManualWeighmentSortColumn, ManualWeighment>({
    request,
    table: "manual_weighments_view",
    select: MANUAL_WEIGHMENT_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_MANUAL_WEIGHMENT_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: [
      "vehicle_number",
      "in_center_name",
      "out_center_name",
      "in_creator_name",
      "in_creator_username",
      "out_creator_name",
      "out_creator_username",
    ],
    integerColumns: [
      "id",
      "in_entry_id",
      "out_entry_id",
      "in_center_id",
      "out_center_id",
      "in_creator_id",
      "out_creator_id",
    ],
    numericColumns: ["net", "gross", "tare"],
    applyCustomFilters: applyManualWeighmentFilters,
  });
}
