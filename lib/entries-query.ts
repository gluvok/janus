/**
 * @file lib/entries-query.ts
 * @description Shared backend query utilities for entries endpoints (/api/entries/automatic and /api/entries/manual).
 * Deduplicates search weight parsing, filter extraction, in-memory relational sorting, and pagination slicing.
 */

import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { z } from "zod";
import {
  parsePagination,
  parseSorting,
  applyDateRange,
  applySortingAndPagination,
  formatPaginatedResponse,
  type SortRule,
  type PaginationParams,
} from "@/lib/api-query";

export interface SortableEntry {
  id: number;
  weight: number | string;
  center?: { name?: string | null } | null;
  customer?: { name?: string | null } | null;
  creator?: { name?: string | null } | null;
}

export const numericWeightSchema = z
  .string()
  .transform((val) => Number(val.replace(/[, ]/g, "").replace(/kg$/i, "")))
  .pipe(z.number().positive());

/**
 * Extracts numeric weight when a user searches for numeric values or values ending in 'kg'.
 * Validates through numericWeightSchema. Returns null if invalid or non-positive.
 */
export function parseNumericWeight(search: string): number | null {
  const result = numericWeightSchema.safeParse(search);
  return result.success ? result.data : null;
}

/**
 * Zod schema to parse and sanitize comma-separated numeric IDs from URL query params.
 */
export const commaSeparatedIdsSchema = z
  .string()
  .transform((val) => {
    const rawItems = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const valid: number[] = [];
    for (const item of rawItems) {
      const parsed = z.coerce.number().int().positive().safeParse(item);
      if (parsed.success) {
        valid.push(parsed.data);
      }
    }
    return valid;
  })
  .pipe(z.array(z.number().int().positive()));

/**
 * Applies common center_id and customer_id filters from URL search params to an entries query
 * using strict Zod schema validation.
 */
export function applyCommonEntriesFilters<
  TQuery extends {
    in(col: string, vals: number[]): TQuery;
  },
>(query: TQuery, searchParams: URLSearchParams): TQuery {
  let updated = query;

  const rawCenterId = searchParams.get("center_id")?.trim();
  if (rawCenterId && rawCenterId !== "all") {
    const parsed = commaSeparatedIdsSchema.safeParse(rawCenterId);
    if (parsed.success && parsed.data.length > 0) {
      updated = updated.in("center_id", parsed.data);
    }
  }

  const rawCustomerId = searchParams.get("customer_id")?.trim();
  if (rawCustomerId && rawCustomerId !== "all") {
    const parsed = commaSeparatedIdsSchema.safeParse(rawCustomerId);
    if (parsed.success && parsed.data.length > 0) {
      updated = updated.in("customer_id", parsed.data);
    }
  }

  return updated;
}

const RELATIONAL_VALUE_GETTERS: Record<string, (item: SortableEntry) => string | number> = {
  center: (item) => item.center?.name ?? "",
  customer: (item) => item.customer?.name ?? "",
  creator: (item) => item.creator?.name ?? "",
  weight: (item) => Number(item.weight ?? 0),
  id: (item) => Number(item.id ?? 0),
};

/**
 * Sorts entries in-memory when sorting across relational joins (center.name, customer.name, creator.name)
 * or composite fields, strictly following multi-column precedence rules.
 */
export function sortEntriesRelational<T extends SortableEntry>(
  entries: T[],
  sortRules: readonly SortRule<string>[],
): T[] {
  if (sortRules.length === 0) {
    return entries;
  }

  return [...entries].sort((a, b) => {
    for (const rule of sortRules) {
      const getter = RELATIONAL_VALUE_GETTERS[rule.col];
      const valA = getter ? getter(a) : String((a as Record<string, unknown>)[rule.col] ?? "");
      const valB = getter ? getter(b) : String((b as Record<string, unknown>)[rule.col] ?? "");

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
 * Slices an in-memory array for pagination.
 */
export function paginateInMemory<T>(items: T[], pagination: PaginationParams): T[] {
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  return items.slice(startIndex, startIndex + pagination.pageSize);
}

const BASE_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "weight",
  "center",
  "customer",
  "created_at",
  "updated_at",
] as const;

const AUTOMATIC_SORT_COLUMNS = [...BASE_SORT_COLUMNS, "detected_vehicle_number"] as const;
const MANUAL_SORT_COLUMNS = [...BASE_SORT_COLUMNS, "creator", "creator_id"] as const;

const BASE_SELECT_FIELDS = [
  "id",
  "center_id",
  "customer_id",
  "vehicle_number",
  "weight",
  "images",
  "created_at",
  "updated_at",
  "center:centers(id, name)",
  "customer:customers(id, name)",
];

const AUTOMATIC_SELECT_PROJECTION = [
  ...BASE_SELECT_FIELDS,
  "device_id",
  "detected_vehicle_number",
].join(",\n  ");

const MANUAL_SELECT_PROJECTION = [
  ...BASE_SELECT_FIELDS,
  "creator_id",
  "creator:users(id, name, role)",
].join(",\n  ");

const ENTRY_CONFIGS = {
  automatic: {
    tableName: "automatic_entries" as const,
    projection: AUTOMATIC_SELECT_PROJECTION,
    allowedSortColumns: AUTOMATIC_SORT_COLUMNS,
    relationalSortCols: new Set(["center", "customer"]),
  },
  manual: {
    tableName: "manual_entries" as const,
    projection: MANUAL_SELECT_PROJECTION,
    allowedSortColumns: MANUAL_SORT_COLUMNS,
    relationalSortCols: new Set(["center", "customer", "creator"]),
  },
} as const;

/**
 * Executes entries query for /api/entries/automatic and /api/entries/manual,
 * handling search, common filters, date ranges, and relational sorting.
 */
export async function executeEntriesGetQuery(
  request: Request,
  mode: "automatic" | "manual",
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const config = ENTRY_CONFIGS[mode];

    const sortRules = parseSorting(searchParams, config.allowedSortColumns, {
      col: "id",
      ascending: false,
    });

    let query: any = (supabase as any)
      .from(config.tableName)
      .select(config.projection, { count: "exact" })
      .is("deleted_at", null);

    const search = searchParams.get("search")?.trim();
    if (search) {
      const numericVal = parseNumericWeight(search);
      if (numericVal !== null) {
        query = query.or(`vehicle_number.ilike.%${search}%,weight.eq.${numericVal}`);
      } else {
        query = query.or(`vehicle_number.ilike.%${search}%`);
      }
    }

    query = applyCommonEntriesFilters(query, searchParams);

    if (mode === "manual") {
      const creatorParam =
        searchParams.get("creator")?.trim() ?? searchParams.get("creator_id")?.trim();
      if (creatorParam && creatorParam !== "all") {
        const parsed = commaSeparatedIdsSchema.safeParse(creatorParam);
        if (parsed.success && parsed.data.length > 0) {
          query = query.in("creator_id", parsed.data);
        }
      }
    }

    query = applyDateRange(query, searchParams);

    const hasRelationalSort = sortRules.some((r) => config.relationalSortCols.has(r.col));

    if (hasRelationalSort) {
      const { data, count, error } = await query;
      if (error) throw error;

      const sorted = sortEntriesRelational((data ?? []) as unknown as SortableEntry[], sortRules);
      const sliced = paginateInMemory(sorted, pagination);

      return NextResponse.json(formatPaginatedResponse(sliced, count, pagination), {
        status: StatusCodes.OK,
      });
    }

    query = applySortingAndPagination(query, sortRules, pagination);
    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      formatPaginatedResponse((data ?? []) as unknown as SortableEntry[], count, pagination),
      { status: StatusCodes.OK },
    );
  } catch (error) {
    console.error(`GET /api/entries/${mode} error:`, error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
