/**
 * @file lib/weighments-query.ts
 * @description Dedicated backend query utilities for weighments querying weighments_view.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import {
  weighmentTypeSchema,
  WEIGHMENT_SELECT_PROJECTION,
  type Weighment,
} from "@/app/weighments/types";

export const ALLOWED_WEIGHMENT_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "gross",
  "tare",
  "net",
  "type",
  "in_time",
  "out_time",
  "created_at",
  "updated_at",
] as const;

export type WeighmentSortColumn = (typeof ALLOWED_WEIGHMENT_SORT_COLUMNS)[number];

const commaSeparatedIdsSchema = z
  .string()
  .transform((val) =>
    val
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0),
  )
  .pipe(z.array(z.number().int().positive()));

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

export async function executeWeighmentsQuery(request: Request): Promise<NextResponse> {
  return executePaginatedEntityQuery<WeighmentSortColumn, Weighment>({
    request,
    table: "weighments_view",
    select: WEIGHMENT_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_WEIGHMENT_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["vehicle_number", "in_center_name", "out_center_name"],
    integerColumns: ["id", "in_entry_id", "out_entry_id"],
    numericColumns: ["net", "gross", "tare"],
    applyCustomFilters: (query, params) => applyCommonWeighmentFilters(query, params),
  });
}
