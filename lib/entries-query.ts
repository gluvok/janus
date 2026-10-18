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
  created_by_user?: { name?: string | null } | null;
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

/**
 * Sorts entries in-memory when sorting across relational joins (center.name, customer.name, created_by_user.name)
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
      let valA: string | number = "";
      let valB: string | number = "";

      if (rule.col === "center") {
        valA = a.center?.name ?? "";
        valB = b.center?.name ?? "";
      } else if (rule.col === "customer") {
        valA = a.customer?.name ?? "";
        valB = b.customer?.name ?? "";
      } else if (rule.col === "created_by") {
        valA = a.created_by_user?.name ?? "";
        valB = b.created_by_user?.name ?? "";
      } else if (rule.col === "weight" || rule.col === "id") {
        valA = Number((a as Record<string, unknown>)[rule.col] ?? 0);
        valB = Number((b as Record<string, unknown>)[rule.col] ?? 0);
      } else {
        valA = String((a as Record<string, unknown>)[rule.col] ?? "");
        valB = String((b as Record<string, unknown>)[rule.col] ?? "");
      }

      let comparison = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        comparison = valA - valB;
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }

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

const AUTOMATIC_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "detected_vehicle_number",
  "weight",
  "center",
  "customer",
  "created_at",
  "updated_at",
] as const;

const MANUAL_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "weight",
  "center",
  "customer",
  "created_by",
  "created_at",
  "updated_at",
] as const;

const AUTOMATIC_SELECT_PROJECTION = `
  id,
  device_id,
  center_id,
  customer_id,
  detected_vehicle_number,
  vehicle_number,
  weight,
  images,
  created_at,
  updated_at,
  center:centers(id, name),
  customer:customers(id, name)
`;

const MANUAL_SELECT_PROJECTION = `
  id,
  center_id,
  customer_id,
  created_by,
  vehicle_number,
  weight,
  images,
  created_at,
  updated_at,
  center:centers(id, name),
  customer:customers(id, name),
  created_by_user:users!manual_entries_created_by_fkey(id, name, role)
`;

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

    const isAutomatic = mode === "automatic";
    const allowedColumns = isAutomatic ? AUTOMATIC_SORT_COLUMNS : MANUAL_SORT_COLUMNS;
    const sortRules = parseSorting(searchParams, allowedColumns, {
      col: "id",
      ascending: false,
    });

    const tableName = isAutomatic ? "automatic_entries" : "manual_entries";
    const projection = isAutomatic ? AUTOMATIC_SELECT_PROJECTION : MANUAL_SELECT_PROJECTION;

    let query: any = (supabase as any)
      .from(tableName)
      .select(projection, { count: "exact" })
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

    if (!isAutomatic) {
      const createdBy = searchParams.get("created_by")?.trim();
      if (createdBy && createdBy !== "all") {
        const parsed = commaSeparatedIdsSchema.safeParse(createdBy);
        if (parsed.success && parsed.data.length > 0) {
          query = query.in("created_by", parsed.data);
        }
      }
    }

    query = applyDateRange(query, searchParams);

    const relationalCols = isAutomatic
      ? ["center", "customer"]
      : ["center", "customer", "created_by"];
    const hasRelationalSort = sortRules.some((r) => relationalCols.includes(r.col));

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
