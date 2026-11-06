/**
 * @file lib/api-query.ts
 * @description Centralized Supabase query runners and route handler envelope executors.
 * Re-exports query parameter schemas, parsers, and pagination formatters from lib/api-query-params.
 */

import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
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
  automatic_weighments: "in_center.factory_id",
  manual_weighments: "in_center.factory_id",
  tickets: "user.factory_id",
};

export interface PaginatedEntityQueryOptions<TCol extends string> {
  request: Request;
  table: string;
  select?: string;
  allowedSortColumns: readonly TCol[];
  defaultSort?: SortRule<TCol>;
  searchColumns?: readonly string[];
  applyCustomFilters?: (query: any, searchParams: URLSearchParams) => any;
}

/**
 * Builds and executes a standard Supabase entity query, returning raw PaginatedResult<TData>.
 * Automatically scopes queries by factory_id across all tables without requiring caller filters.
 */
export async function buildPaginatedEntityResult<TCol extends string, TData = unknown>({
  searchParams,
  table,
  select = "*",
  allowedSortColumns,
  defaultSort,
  searchColumns = [],
  applyCustomFilters,
  factoryId,
}: Omit<PaginatedEntityQueryOptions<TCol>, "request"> & {
  searchParams: URLSearchParams;
  factoryId: number;
}): Promise<PaginatedResult<TData>> {
  const isAll = searchParams.get("all") === "true";
  const pagination = parsePagination(searchParams);
  const sortRules = parseSorting(searchParams, allowedSortColumns, defaultSort);

  let query: any = supabase.from(table).select(select, { count: "exact" });

  const factoryColumn = TABLE_FACTORY_COLUMNS[table];
  if (factoryColumn) {
    query = query.eq(factoryColumn, factoryId);
  }

  const search = searchParams.get("search")?.trim();
  if (search && searchColumns.length > 0) {
    if (searchColumns.length === 1) {
      query = query.ilike(searchColumns[0], `%${search}%`);
    } else {
      const orConditions = searchColumns.map((col) => `${col}.ilike.%${search}%`).join(",");
      query = query.or(orConditions);
    }
  }

  query = applyDateRange(query, searchParams);

  if (applyCustomFilters) {
    query = applyCustomFilters(query, searchParams);
  }

  if (isAll) {
    const activeSort = sortRules.length > 0 ? sortRules : defaultSort ? [defaultSort] : [];
    query = applySorting(query, activeSort);
  } else {
    query = applySortingAndPagination(query, sortRules, pagination);
  }

  const { data, count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  if (isAll) {
    return {
      data: (data ?? []) as TData[],
      totalCount: data?.length ?? 0,
      page: 1,
      pageSize: data?.length ?? 0,
      totalPages: 1,
    };
  }

  return formatPaginatedResponse<TData>(data as TData[] | null, count, pagination);
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
