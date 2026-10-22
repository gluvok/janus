/**
 * @file lib/weighments-query.ts
 * @description Shared backend query utilities for weighments endpoints (/api/weighments/automatic and /api/weighments/manual).
 * Handles Supabase dual-entry joins, computed weight fields, directional relational sorting, and directional filtering.
 */

import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { z } from "zod";
import {
  parsePagination,
  parseSorting,
  applyDateRange,
  formatPaginatedResponse,
  type SortRule,
  type PaginationParams,
} from "@/lib/api-query";
import { commaSeparatedIdsSchema, parseNumericWeight } from "@/lib/entries-query";

export type WeighmentMode = "automatic" | "manual";
export type WeighmentType = "in" | "out" | "na";

export interface WeighmentEntryRow {
  id: number;
  vehicle_number: string;
  weight: number;
  images: string[];
  center_id: number;
  customer_id: number | null;
  created_at: string;
  center: { id: number; name: string };
  customer: { id: number; name: string } | null;
}

export interface RawWeighmentRow {
  id: number;
  type: WeighmentType;
  created_at: string;
  updated_at: string;
  in_entry: WeighmentEntryRow;
  out_entry: WeighmentEntryRow;
}

export interface ComputedWeighment {
  id: number;
  type: WeighmentType;
  created_at: string;
  updated_at: string;
  vehicle_number: string;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  in_entry: WeighmentEntryRow;
  out_entry: WeighmentEntryRow;
}

const AUTOMATIC_WEIGHMENTS_PROJECTION = `
  id,
  type,
  created_at,
  updated_at,
  in_entry:automatic_entries!in_entry_id (
    id,
    vehicle_number,
    weight,
    images,
    center_id,
    customer_id,
    created_at,
    center:centers(id, name),
    customer:customers(id, name)
  ),
  out_entry:automatic_entries!out_entry_id (
    id,
    vehicle_number,
    weight,
    images,
    center_id,
    customer_id,
    created_at,
    center:centers(id, name),
    customer:customers(id, name)
  )
`;

const MANUAL_WEIGHMENTS_PROJECTION = `
  id,
  type,
  created_at,
  updated_at,
  in_entry:manual_entries!in_entry_id (
    id,
    vehicle_number,
    weight,
    images,
    center_id,
    customer_id,
    created_at,
    center:centers(id, name),
    customer:customers(id, name)
  ),
  out_entry:manual_entries!out_entry_id (
    id,
    vehicle_number,
    weight,
    images,
    center_id,
    customer_id,
    created_at,
    center:centers(id, name),
    customer:customers(id, name)
  )
`;

export const ALLOWED_WEIGHMENT_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "type",
  "net_weight",
  "gross_weight",
  "tare_weight",
  "in_center",
  "out_center",
  "in_customer",
  "out_customer",
  "in_time",
  "out_time",
  "created_at",
  "updated_at",
] as const;

export type AllowedWeighmentSortColumn = (typeof ALLOWED_WEIGHMENT_SORT_COLUMNS)[number];

const SORT_VALUE_GETTERS: Record<
  AllowedWeighmentSortColumn,
  (item: ComputedWeighment) => string | number
> = {
  id: (w) => w.id,
  vehicle_number: (w) => w.vehicle_number.toLowerCase(),
  type: (w) => w.type,
  net_weight: (w) => w.net_weight,
  gross_weight: (w) => w.gross_weight,
  tare_weight: (w) => w.tare_weight,
  in_center: (w) => w.in_entry.center.name.toLowerCase(),
  out_center: (w) => w.out_entry.center.name.toLowerCase(),
  in_customer: (w) => w.in_entry.customer?.name.toLowerCase() ?? "",
  out_customer: (w) => w.out_entry.customer?.name.toLowerCase() ?? "",
  in_time: (w) => new Date(w.in_entry.created_at).getTime(),
  out_time: (w) => new Date(w.out_entry.created_at).getTime(),
  created_at: (w) => new Date(w.created_at).getTime(),
  updated_at: (w) => new Date(w.updated_at).getTime(),
};

/**
 * Computes derived gross, tare, and net weights along with normalized vehicle number
 * from raw in/out entry relations without defensive fallback code.
 */
export function computeWeighmentFields(row: RawWeighmentRow): ComputedWeighment {
  const gross_weight = Math.max(row.in_entry.weight, row.out_entry.weight);
  const tare_weight = Math.min(row.in_entry.weight, row.out_entry.weight);
  const net_weight = gross_weight - tare_weight;

  return {
    id: row.id,
    type: row.type,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vehicle_number: row.in_entry.vehicle_number,
    gross_weight,
    tare_weight,
    net_weight,
    in_entry: row.in_entry,
    out_entry: row.out_entry,
  };
}

/**
 * Filters computed weighments in-memory by search, type, and directional center/customer parameters.
 */
export function filterComputedWeighments(
  items: ComputedWeighment[],
  searchParams: URLSearchParams,
): ComputedWeighment[] {
  let filtered = items;

  // 1. Inbound Center Filter
  const rawInCenterId = searchParams.get("in_center_id")?.trim();
  if (rawInCenterId && rawInCenterId !== "all") {
    const parsed = commaSeparatedIdsSchema.safeParse(rawInCenterId);
    if (parsed.success && parsed.data.length > 0) {
      const allowed = new Set(parsed.data);
      filtered = filtered.filter((w) => allowed.has(w.in_entry.center_id));
    }
  }

  // 2. Outbound Center Filter
  const rawOutCenterId = searchParams.get("out_center_id")?.trim();
  if (rawOutCenterId && rawOutCenterId !== "all") {
    const parsed = commaSeparatedIdsSchema.safeParse(rawOutCenterId);
    if (parsed.success && parsed.data.length > 0) {
      const allowed = new Set(parsed.data);
      filtered = filtered.filter((w) => allowed.has(w.out_entry.center_id));
    }
  }

  // 3. Inbound Customer Filter
  const rawInCustId = searchParams.get("in_customer_id")?.trim();
  if (rawInCustId && rawInCustId !== "all") {
    const parsed = commaSeparatedIdsSchema.safeParse(rawInCustId);
    if (parsed.success && parsed.data.length > 0) {
      const allowed = new Set(parsed.data);
      filtered = filtered.filter(
        (w) => w.in_entry.customer_id !== null && allowed.has(w.in_entry.customer_id),
      );
    }
  }

  // 4. Outbound Customer Filter
  const rawOutCustId = searchParams.get("out_customer_id")?.trim();
  if (rawOutCustId && rawOutCustId !== "all") {
    const parsed = commaSeparatedIdsSchema.safeParse(rawOutCustId);
    if (parsed.success && parsed.data.length > 0) {
      const allowed = new Set(parsed.data);
      filtered = filtered.filter(
        (w) => w.out_entry.customer_id !== null && allowed.has(w.out_entry.customer_id),
      );
    }
  }

  // 5. Type Filter ('in' | 'out' | 'na')
  const rawType = searchParams.get("type")?.trim().toLowerCase();
  if (rawType && rawType !== "all" && (rawType === "in" || rawType === "out" || rawType === "na")) {
    filtered = filtered.filter((w) => w.type === rawType);
  }

  // 6. Search Filter (matches vehicle number, ID, or numeric weight)
  const rawSearch = searchParams.get("search")?.trim();
  if (rawSearch) {
    const searchLower = rawSearch.toLowerCase();
    const searchWeight = parseNumericWeight(rawSearch);
    const searchId = z.coerce.number().int().positive().safeParse(rawSearch);

    filtered = filtered.filter((w) => {
      if (w.vehicle_number.toLowerCase().includes(searchLower)) {
        return true;
      }
      if (searchId.success && w.id === searchId.data) {
        return true;
      }
      if (searchWeight !== null) {
        return (
          w.net_weight === searchWeight ||
          w.gross_weight === searchWeight ||
          w.tare_weight === searchWeight
        );
      }
      return false;
    });
  }

  return filtered;
}

/**
 * Sorts computed weighments in-memory following multi-column precedence rules.
 */
export function sortComputedWeighments(
  items: ComputedWeighment[],
  sortRules: readonly SortRule<AllowedWeighmentSortColumn>[],
): ComputedWeighment[] {
  if (sortRules.length === 0) {
    return [...items].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  return [...items].sort((a, b) => {
    for (const rule of sortRules) {
      const getter = SORT_VALUE_GETTERS[rule.col];
      const valA = getter ? getter(a) : "";
      const valB = getter ? getter(b) : "";

      const comparison =
        typeof valA === "number" && typeof valB === "number"
          ? valA - valB
          : String(valA).localeCompare(String(valB));

      if (comparison !== 0) {
        return rule.ascending ? comparison : -comparison;
      }
    }
    return 0;
  });
}

/**
 * Slices an in-memory array of computed weighments for pagination.
 */
export function paginateComputedWeighments(
  items: ComputedWeighment[],
  pagination: PaginationParams,
): ComputedWeighment[] {
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  return items.slice(startIndex, startIndex + pagination.pageSize);
}

/**
 * Centralized query runner for /api/weighments/automatic and /api/weighments/manual.
 */
export async function executeWeighmentsGetQuery(
  request: Request,
  mode: WeighmentMode,
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Parse pagination & sorting params using Zod
    const pagination = parsePagination(searchParams);
    const sortRules = parseSorting<AllowedWeighmentSortColumn>(
      searchParams,
      ALLOWED_WEIGHMENT_SORT_COLUMNS,
    );

    // 2. Select projection & table name
    const tableName = mode === "automatic" ? "automatic_weighments" : "manual_weighments";
    const projection =
      mode === "automatic" ? AUTOMATIC_WEIGHMENTS_PROJECTION : MANUAL_WEIGHMENTS_PROJECTION;

    // 3. Assemble Supabase base query with date filtering
    let query = supabase.from(tableName).select(projection);

    query = applyDateRange(query, searchParams);

    const { data: rawData, error } = await query;

    if (error) {
      console.error(`[API /api/weighments/${mode}] Supabase fetch error:`, error);
      return NextResponse.json(
        {
          error: "Failed to fetch weighments",
          code: error.code,
          details: error.message,
        },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    // 4. Compute derived weights for each row
    const rawRows = (rawData ?? []) as unknown as RawWeighmentRow[];
    const computedRows = rawRows.map(computeWeighmentFields);

    // 5. In-memory filter by search, type, and directional center / customer
    const filteredRows = filterComputedWeighments(computedRows, searchParams);
    const totalCount = filteredRows.length;

    // 6. In-memory multi-column sort
    const sortedRows = sortComputedWeighments(filteredRows, sortRules);

    // 7. Slicing pagination
    const paginatedRows = paginateComputedWeighments(sortedRows, pagination);

    return NextResponse.json(formatPaginatedResponse(paginatedRows, totalCount, pagination), {
      status: StatusCodes.OK,
    });
  } catch (err) {
    console.error(`[API /api/weighments/${mode}] Unexpected exception:`, err);
    return NextResponse.json(
      {
        error: "Internal server error occurred while retrieving weighments",
      },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }
}
