/**
 * @file lib/weighments-query.ts
 * @description Shared backend query utilities for weighments endpoints (/api/weighments/automatic and /api/weighments/manual).
 * Executes paginated queries directly against automatic_weighments and manual_weighments with PostgreSQL stored generated columns.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import type { Weighment, WeighmentMode } from "@/app/weighments/types";

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

const AUTOMATIC_PROJECTION = `
  id,
  vehicle_number,
  in_detected_vehicle_number,
  out_detected_vehicle_number,
  in_weight,
  out_weight,
  in_time,
  out_time,
  in_center_id,
  out_center_id,
  images,
  gross,
  tare,
  net,
  type,
  created_at,
  updated_at,
  in_center:centers!in_center_id(id, name),
  out_center:centers!out_center_id(id, name)
` as const;

const MANUAL_PROJECTION = `
  id,
  vehicle_number,
  in_weight,
  out_weight,
  in_time,
  out_time,
  in_center_id,
  out_center_id,
  images,
  gross,
  tare,
  net,
  type,
  created_at,
  updated_at,
  in_center:centers!in_center_id(id, name),
  out_center:centers!out_center_id(id, name),
  in_creator:users!in_creator_id(id, name, username),
  out_creator:users!out_creator_id(id, name, username)
` as const;

const PROJECTIONS: Record<WeighmentMode, string> = {
  automatic: AUTOMATIC_PROJECTION,
  manual: MANUAL_PROJECTION,
};

const TABLES: Record<WeighmentMode, string> = {
  automatic: "automatic_weighments",
  manual: "manual_weighments",
};

const weighmentTypeFilterSchema = z.enum(["pending", "in", "out", "unassigned"]);

const commaSeparatedIdsSchema = z
  .string()
  .transform((val) =>
    val
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0),
  )
  .pipe(z.array(z.number().int().positive()));

export async function executeWeighmentsGetQuery(
  request: Request,
  mode: WeighmentMode,
): Promise<NextResponse> {
  const table = TABLES[mode];
  const select = PROJECTIONS[mode];

  return executePaginatedEntityQuery<WeighmentSortColumn, Weighment>({
    request,
    table,
    select,
    allowedSortColumns: ALLOWED_WEIGHMENT_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["vehicle_number"],
    applyCustomFilters: (query, searchParams) => {
      let filteredQuery = query;

      // Filter by type ('pending' | 'in' | 'out' | 'unassigned')
      const rawType = searchParams.get("type")?.trim();
      if (rawType && rawType !== "all") {
        const parsedType = weighmentTypeFilterSchema.safeParse(rawType);
        if (parsedType.success) {
          filteredQuery = filteredQuery.eq("type", parsedType.data);
        }
      }

      // Filter by centers (in_center or out_center)
      const rawCenters = searchParams.get("center_ids") || searchParams.get("center_id");
      if (rawCenters && rawCenters !== "all") {
        const parsedIds = commaSeparatedIdsSchema.safeParse(rawCenters);
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
    },
  });
}
