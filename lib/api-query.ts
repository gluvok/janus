/**
 * @file lib/api-query.ts
 * @description Centralized Supabase query runners and route handler envelope executors.
 * Re-exports query parameter schemas, parsers, and pagination formatters from lib/api-query-params.
 */

import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import {
  parsePagination,
  parseSorting,
  applyDateRange,
  formatPaginatedResponse,
  type SortRule,
  type PaginationParams,
  type PaginatedResult,
} from "./api-query-params";

// Re-export all parameter parsing utilities and types for backwards compatibility
export * from "./api-query-params";

/**
 * Applies sequential sorting rules to a Supabase query builder.
 */
export function applySorting<
  TQuery extends {
    order(col: string, opts: { ascending: boolean }): TQuery;
  },
>(query: TQuery, sortRules: readonly SortRule<string>[]): TQuery {
  let updated = query;
  for (const rule of sortRules) {
    updated = updated.order(rule.col, { ascending: rule.ascending });
  }
  return updated;
}

/**
 * Applies sequential sorting rules and range pagination slice to a Supabase query builder.
 */
export function applySortingAndPagination<
  TQuery extends {
    order(col: string, opts: { ascending: boolean }): TQuery;
    range(from: number, to: number): TQuery;
  },
>(query: TQuery, sortRules: readonly SortRule<string>[], pagination: PaginationParams): TQuery {
  return applySorting(query, sortRules).range(
    pagination.offset,
    pagination.offset + pagination.pageSize - 1,
  );
}

const TABLE_FACTORY_COLUMNS: Record<string, string> = {
  centers: "factory_id",
  users: "factory_id",
  factories: "id",
  automatic_entries_view: "factory_id",
  manual_entries_view: "factory_id",
  automatic_weighments_view: "factory_id",
  manual_weighments_view: "factory_id",
  automatic_tickets_view: "factory_id",
  manual_tickets_view: "factory_id",
};

export const commaSeparatedIdsSchema = z
  .string()
  .transform((val) =>
    val
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0),
  )
  .pipe(z.array(z.number().int().positive()));

export function applyCommaSeparatedIdFilter(
  query: any,
  paramValue: string | null | undefined,
  column: string,
): any {
  const trimmed = paramValue?.trim();
  if (!trimmed || trimmed === "all") return query;
  const parsed = commaSeparatedIdsSchema.safeParse(trimmed);
  if (parsed.success && parsed.data.length > 0) {
    return query.in(column, parsed.data);
  }
  return query;
}

export interface PaginatedEntityQueryOptions<TCol extends string> {
  request: Request;
  table: string;
  select?: string;
  allowedSortColumns: readonly TCol[];
  defaultSort: SortRule<TCol>;
  searchColumns?: readonly string[];
  textColumns?: readonly string[];
  integerColumns?: readonly string[];
  numericColumns?: readonly string[];
  extraOrConditions?: readonly string[];
  applyCustomFilters?: (query: any, searchParams: URLSearchParams) => any;
}

/**
 * Builds the common Supabase query foundation with tenant isolation, search filters, date range, and custom filters.
 */
export function buildBaseEntityQuery({
  table,
  select = "*",
  searchColumns = [],
  textColumns = [],
  integerColumns = [],
  numericColumns = [],
  extraOrConditions = [],
  applyCustomFilters,
  factoryId,
  searchParams,
  countExact,
}: {
  table: string;
  select?: string;
  searchColumns?: readonly string[];
  textColumns?: readonly string[];
  integerColumns?: readonly string[];
  numericColumns?: readonly string[];
  extraOrConditions?: readonly string[];
  applyCustomFilters?: (query: any, searchParams: URLSearchParams) => any;
  factoryId: number;
  searchParams: URLSearchParams;
  countExact: boolean;
}) {
  let query: any = countExact
    ? supabase.from(table).select(select, { count: "exact" })
    : supabase.from(table).select(select);

  const factoryColumn = TABLE_FACTORY_COLUMNS[table];
  if (factoryColumn) {
    query = query.eq(factoryColumn, factoryId);
  }

  const search = searchParams.get("search")?.trim();
  if (search) {
    const conditions: string[] = [];

    // Text columns with ILIKE
    const allTextCols = [...textColumns, ...searchColumns];
    for (const col of allTextCols) {
      conditions.push(`${col}.ilike.%${search}%`);
    }

    // Integer columns with EQ
    if (integerColumns.length > 0 && /^\d+$/.test(search)) {
      for (const col of integerColumns) {
        conditions.push(`${col}.eq.${search}`);
      }
    }

    // Numeric columns with EQ
    if (numericColumns.length > 0 && !Number.isNaN(Number(search))) {
      const num = Number(search);
      for (const col of numericColumns) {
        conditions.push(`${col}.eq.${num}`);
      }
    }

    // Extra OR conditions (e.g. relations subquery matches)
    if (extraOrConditions.length > 0) {
      conditions.push(...extraOrConditions);
    }

    if (conditions.length === 1) {
      const parts = conditions[0].split(".");
      if (parts.length === 3 && parts[1] === "ilike") {
        query = query.ilike(parts[0], parts[2]);
      } else if (parts.length === 3 && parts[1] === "eq") {
        query = query.eq(parts[0], parts[2]);
      } else {
        query = query.or(conditions[0]);
      }
    } else if (conditions.length > 1) {
      query = query.or(conditions.join(","));
    }
  }

  query = applyDateRange(query, searchParams);

  if (applyCustomFilters) {
    query = applyCustomFilters(query, searchParams);
  }

  return query;
}

/**
 * Builds and executes a standard paginated Supabase entity query, returning raw PaginatedResult<TData>.
 */
export async function buildPaginatedEntityResult<TCol extends string, TData = unknown>({
  searchParams,
  table,
  select = "*",
  allowedSortColumns,
  defaultSort,
  searchColumns = [],
  textColumns = [],
  integerColumns = [],
  numericColumns = [],
  extraOrConditions = [],
  applyCustomFilters,
  factoryId,
}: Omit<PaginatedEntityQueryOptions<TCol>, "request"> & {
  searchParams: URLSearchParams;
  factoryId: number;
}): Promise<PaginatedResult<TData>> {
  const pagination = parsePagination(searchParams);
  const sortRules = parseSorting(searchParams, allowedSortColumns, defaultSort);

  let query = buildBaseEntityQuery({
    table,
    select,
    searchColumns,
    textColumns,
    integerColumns,
    numericColumns,
    extraOrConditions,
    applyCustomFilters,
    factoryId,
    searchParams,
    countExact: true,
  });

  query = applySortingAndPagination(query, sortRules, pagination);

  const { data, count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return formatPaginatedResponse<TData>(data as TData[] | null, count, pagination);
}

/**
 * Builds and executes an unpaginated Supabase entity query, returning all matching records.
 */
export async function buildAllEntityResult<TCol extends string, TData = unknown>({
  searchParams,
  table,
  select = "*",
  allowedSortColumns,
  defaultSort,
  searchColumns = [],
  textColumns = [],
  integerColumns = [],
  numericColumns = [],
  extraOrConditions = [],
  applyCustomFilters,
  factoryId,
}: Omit<PaginatedEntityQueryOptions<TCol>, "request"> & {
  searchParams: URLSearchParams;
  factoryId: number;
}): Promise<{ data: TData[] }> {
  const sortRules = parseSorting(searchParams, allowedSortColumns, defaultSort);

  let query = buildBaseEntityQuery({
    table,
    select,
    searchColumns,
    textColumns,
    integerColumns,
    numericColumns,
    extraOrConditions,
    applyCustomFilters,
    factoryId,
    searchParams,
    countExact: false,
  });

  const activeSort = sortRules.length > 0 ? sortRules : [defaultSort];
  query = applySorting(query, activeSort);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return { data: (data ?? []) as TData[] };
}

/**
 * Executes a standardized paginated entity query for Next.js route handlers, returning a NextResponse envelope.
 * Automatically injects factoryId from request headers for tenant isolation.
 */
export async function executePaginatedEntityQuery<TCol extends string, TData = unknown>(
  options: PaginatedEntityQueryOptions<TCol>,
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(options.request.url);
    const factoryId = Number(options.request.headers.get("x-factory-id"));

    const result = await buildPaginatedEntityResult<TCol, TData>({
      ...options,
      factoryId,
      searchParams,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

/**
 * Executes an unpaginated entity query for Next.js route handlers, returning a { data: TData[] } envelope.
 * Automatically injects factoryId from request headers for tenant isolation.
 */
export async function executeAllEntityQuery<TCol extends string, TData = unknown>(
  options: PaginatedEntityQueryOptions<TCol>,
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(options.request.url);
    const factoryId = Number(options.request.headers.get("x-factory-id"));

    const result = await buildAllEntityResult<TCol, TData>({
      ...options,
      factoryId,
      searchParams,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
