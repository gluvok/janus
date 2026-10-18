/**
 * @file lib/api-query.ts
 * @description Centralized, reusable API query utilities for pagination, multi-column sorting,
 * date range filtering, and standardized paginated response envelopes across route handlers.
 */

import { z } from "zod";

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

export interface SortRule<T extends string = string> {
  col: T;
  ascending: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(15).default(15),
});

const dateQuerySchema = z.string().trim().pipe(z.coerce.date());

/**
 * Parses and validates pagination parameters from URL search params using Zod.
 * Automatically coerces and clamps page (>= 1) and pageSize ([1, 100]), falling back to defaults.
 */
export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const { page, pageSize } = paginationQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  return { page, pageSize, offset: (page - 1) * pageSize };
}

/**
 * Creates a reusable Zod schema to parse and validate multi-column sort queries.
 */
export function createSortRulesSchema<T extends string>(allowedColumns: readonly T[]) {
  const allowedSet = new Set<string>(allowedColumns);
  return z.string().transform((val) => {
    const rules: SortRule<T>[] = [];
    const parts = val.split(",");
    for (const part of parts) {
      const [colName, dir] = part.split(/[.:]/);
      const trimmedCol = colName?.trim() as T;
      if (allowedSet.has(trimmedCol)) {
        const isAsc = dir?.trim().toLowerCase() !== "desc";
        rules.push({
          col: trimmedCol,
          ascending: isAsc,
        });
      }
    }
    return rules;
  });
}

/**
 * Parses multi-column sorting parameters from URL search params (e.g. "?sort=col1.asc,col2.desc") using Zod.
 * Validates each requested column against an allowed whitelist and applies the explicit default fallback if empty.
 */
export function parseSorting<T extends string>(
  searchParams: URLSearchParams,
  allowedColumns: readonly T[],
  defaultSort: SortRule<T>,
): SortRule<T>[] {
  const requestedSort = searchParams.get("sort")?.trim();
  if (requestedSort) {
    const schema = createSortRulesSchema(allowedColumns);
    const parsed = schema.safeParse(requestedSort);
    if (parsed.success && parsed.data.length > 0) {
      return parsed.data;
    }
  }

  return [defaultSort];
}

/**
 * Applies optional 'from' and 'to' date range filters to a Supabase query with Zod validation.
 * 'to' date is normalized to end-of-day (23:59:59.999) for inclusive date matching.
 */
export function applyDateRange<
  TQuery extends {
    gte(col: string, val: string): TQuery;
    lte(col: string, val: string): TQuery;
  },
>(query: TQuery, searchParams: URLSearchParams): TQuery {
  let updated = query;
  const rawFrom = searchParams.get("from");
  if (rawFrom) {
    const parsed = dateQuerySchema.safeParse(rawFrom);
    if (parsed.success) {
      updated = updated.gte("created_at", parsed.data.toISOString());
    }
  }

  const rawTo = searchParams.get("to");
  if (rawTo) {
    const parsed = dateQuerySchema.safeParse(rawTo);
    if (parsed.success) {
      const toDate = new Date(parsed.data);
      toDate.setHours(23, 59, 59, 999);
      updated = updated.lte("created_at", toDate.toISOString());
    }
  }

  return updated;
}

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

/**
 * Formats a standardized JSON response envelope with data and pagination metadata.
 */
export function formatPaginatedResponse<T>(
  data: T[] | null | undefined,
  count: number | null | undefined,
  pagination: PaginationParams,
): PaginatedResult<T> {
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

  return {
    data: data ?? [],
    totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages,
  };
}
