import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { quotePostgrestValue } from "@/lib/security";
import {
  parsePagination,
  parseSorting,
  applyDateRange,
  formatPaginatedResponse,
  type SortRule,
  type PaginationParams,
  type PaginatedResult,
} from "./api-query-params";

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

/** The PostgREST builder methods this layer calls; supabase-js query builders satisfy it structurally. */
export interface FilterBuilder<TQuery> {
  eq(column: string, value: string | number): TQuery;
  in(column: string, values: readonly (string | number)[]): TQuery;
  is(column: string, value: null): TQuery;
  or(filters: string): TQuery;
  gte(column: string, value: string): TQuery;
  lte(column: string, value: string): TQuery;
  order(column: string, options: { ascending: boolean }): TQuery;
  range(from: number, to: number): TQuery;
}

const TABLE_FACTORY_COLUMNS: Record<string, string> = {
  centers: "factory_id",
  users: "factory_id",
  factories: "id",
  automatic_entries_view: "factory_id",
  manual_entries_view: "factory_id",
  automatic_weighments_view: "factory_id",
  manual_weighments_view: "factory_id",
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

export function applyCommaSeparatedIdFilter<TQuery extends FilterBuilder<TQuery>>(
  query: TQuery,
  paramValue: string | null | undefined,
  column: string,
): TQuery {
  const trimmed = paramValue?.trim();
  if (!trimmed || trimmed === "all") return query;
  const parsed = commaSeparatedIdsSchema.safeParse(trimmed);
  if (parsed.success && parsed.data.length > 0) {
    return query.in(column, parsed.data);
  }
  return query;
}

export function applyCommaSeparatedEnumFilter<
  TQuery extends FilterBuilder<TQuery>,
  T extends string,
>(
  query: TQuery,
  paramValue: string | null | undefined,
  column: string,
  schema: z.ZodType<T>,
): TQuery {
  const trimmed = paramValue?.trim();
  if (!trimmed || trimmed === "all") return query;
  const values = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => schema.safeParse(s))
    .filter((r): r is { success: true; data: T } => r.success)
    .map((r) => r.data);
  if (values.length === 1) {
    return query.eq(column, values[0]);
  }
  if (values.length > 1) {
    return query.in(column, values);
  }
  return query;
}

export interface EnumColumnConfig {
  column: string;
  values: readonly string[];
}

export interface BaseEntityQueryConfig {
  table: string;
  select?: string;
  searchColumns?: readonly string[];
  integerColumns?: readonly string[];
  numericColumns?: readonly string[];
  enumColumns?: readonly EnumColumnConfig[];
  integerFilterColumns?: readonly string[];
  applyCustomFilters?: <TQuery extends FilterBuilder<TQuery>>(
    query: TQuery,
    searchParams: URLSearchParams,
  ) => TQuery;
}

export interface PaginatedEntityQueryOptions<TCol extends string> extends BaseEntityQueryConfig {
  request: Request;
  allowedSortColumns: readonly TCol[];
  defaultSort: SortRule<TCol>;
}

/**
 * Builds the common Supabase query foundation with tenant isolation, search filters, date range, and custom filters.
 */
export function buildBaseEntityQuery({
  table,
  select = "*",
  searchColumns = [],
  integerColumns = [],
  numericColumns = [],
  enumColumns = [],
  integerFilterColumns = [],
  applyCustomFilters,
  factoryId,
  searchParams,
  countExact,
}: BaseEntityQueryConfig & {
  factoryId: number;
  searchParams: URLSearchParams;
  countExact: boolean;
}) {
  let query = countExact
    ? supabase.from(table).select(select, { count: "exact" })
    : supabase.from(table).select(select);

  const factoryColumn = TABLE_FACTORY_COLUMNS[table];
  if (factoryColumn) {
    query = query.eq(factoryColumn, factoryId);
  }

  const search = searchParams.get("search")?.trim();
  if (search) {
    const conditions: string[] = [];

    for (const col of searchColumns) {
      conditions.push(`${col}.ilike.${quotePostgrestValue(`%${search}%`)}`);
    }

    if (integerColumns.length > 0 && /^\d+$/.test(search)) {
      for (const col of integerColumns) {
        conditions.push(`${col}.eq.${search}`);
      }
    }

    if (numericColumns.length > 0 && !Number.isNaN(Number(search))) {
      const num = Number(search);
      for (const col of numericColumns) {
        conditions.push(`${col}.eq.${num}`);
      }
    }

    // enums can't ILIKE: match the term against the enum values instead
    if (enumColumns.length > 0) {
      const lowerSearch = search.toLowerCase();
      for (const { column, values } of enumColumns) {
        const matches = values.filter((val) => val.toLowerCase().includes(lowerSearch));
        if (matches.length > 0) {
          conditions.push(`${column}.in.(${matches.join(",")})`);
        }
      }
    }

    if (conditions.length > 0) {
      query = query.or(conditions.join(","));
    }
  }

  query = applyDateRange(query, searchParams);

  for (const col of integerFilterColumns) {
    query = applyCommaSeparatedIdFilter(query, searchParams.get(col), col);
  }

  if (applyCustomFilters) {
    query = applyCustomFilters(query, searchParams);
  }

  return query;
}

export async function buildPaginatedEntityResult<TCol extends string, TData = unknown>({
  searchParams,
  table,
  select = "*",
  allowedSortColumns,
  defaultSort,
  searchColumns = [],
  integerColumns = [],
  numericColumns = [],
  enumColumns = [],
  integerFilterColumns = [],
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
    integerColumns,
    numericColumns,
    enumColumns,
    integerFilterColumns,
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

export async function buildAllEntityResult<TCol extends string, TData = unknown>({
  searchParams,
  table,
  select = "*",
  allowedSortColumns,
  defaultSort,
  searchColumns = [],
  integerColumns = [],
  numericColumns = [],
  enumColumns = [],
  integerFilterColumns = [],
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
    integerColumns,
    numericColumns,
    enumColumns,
    integerFilterColumns,
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

/** Scopes the query to the `x-factory-id` request header (tenant isolation). */
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
    console.error("Entity query error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }
}

/** Scopes the query to the `x-factory-id` request header (tenant isolation). */
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
    console.error("Entity query error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }
}
