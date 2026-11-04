/**
 * @file lib/api-query.ts
 * @description Centralized Drizzle query runners and route handler envelope executors for Turso / LibSQL.
 * Re-exports query parameter schemas, parsers, and pagination formatters from lib/api-query-params.
 */

import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { and, or, like, gte, lte, asc, desc, count, type SQL } from "drizzle-orm";
import { type SQLiteTable } from "drizzle-orm/sqlite-core";
import { db, schema } from "@/db/client";
import {
  parsePagination,
  parseSorting,
  dateQuerySchema,
  formatPaginatedResponse,
  type SortRule,
  type PaginatedResult,
} from "./api-query-params";

// Re-export all parameter parsing utilities and types for backwards compatibility
export * from "./api-query-params";

export const TABLE_MAP = {
  factories: schema.factories,
  centers: schema.centers,
  customers: schema.customers,
  users: schema.users,
  devices: schema.devices,
  sessions: schema.sessions,
  manual_entries: schema.manual_entries,
  automatic_entries: schema.automatic_entries,
  manual_weighments: schema.manual_weighments,
  automatic_weighments: schema.automatic_weighments,
  tickets: schema.tickets,
} as const;

export type KnownTableName = keyof typeof TABLE_MAP;

export interface PaginatedEntityQueryOptions<TCol extends string> {
  request: Request;
  table: KnownTableName | SQLiteTable;
  select?: string;
  allowedSortColumns: readonly TCol[];
  defaultSort?: SortRule<TCol>;
  searchColumns?: readonly string[];
  applyCustomFilters?: (whereConditions: SQL[], searchParams: URLSearchParams) => void;
}

/**
 * Builds and executes a standard Drizzle / LibSQL entity query, returning raw PaginatedResult<TData>.
 */
export async function buildPaginatedEntityResult<TCol extends string, TData = unknown>({
  searchParams,
  table,
  select = "*",
  allowedSortColumns,
  defaultSort,
  searchColumns = [],
  applyCustomFilters,
}: Omit<PaginatedEntityQueryOptions<TCol>, "request"> & {
  searchParams: URLSearchParams;
}): Promise<PaginatedResult<TData>> {
  const isAll = searchParams.get("all") === "true";
  const pagination = parsePagination(searchParams);
  const sortRules = parseSorting(searchParams, allowedSortColumns, defaultSort);

  const tableObj: any = typeof table === "string" ? TABLE_MAP[table as KnownTableName] : table;
  if (!tableObj) {
    throw new Error(`Unknown database table: ${String(table)}`);
  }

  const whereConditions: SQL[] = [];

  // Search filter across specified search columns
  const search = searchParams.get("search")?.trim();
  if (search && searchColumns.length > 0) {
    const searchOrs: SQL[] = [];
    for (const col of searchColumns) {
      const colObj = tableObj[col];
      if (colObj) {
        searchOrs.push(like(colObj, `%${search}%`));
      }
    }
    if (searchOrs.length > 0) {
      whereConditions.push(or(...searchOrs)!);
    }
  }

  // Date range filters
  const rawFrom = searchParams.get("from");
  if (rawFrom) {
    const parsed = dateQuerySchema.safeParse(rawFrom);
    if (parsed.success && "created_at" in tableObj) {
      whereConditions.push(gte(tableObj.created_at, parsed.data.toISOString()));
    }
  }

  const rawTo = searchParams.get("to");
  if (rawTo) {
    const parsed = dateQuerySchema.safeParse(rawTo);
    if (parsed.success && "created_at" in tableObj) {
      const toDate = new Date(parsed.data);
      toDate.setHours(23, 59, 59, 999);
      whereConditions.push(lte(tableObj.created_at, toDate.toISOString()));
    }
  }

  // Custom filters
  if (applyCustomFilters) {
    applyCustomFilters(whereConditions, searchParams);
  }

  const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // Total count query
  const [{ total }] = await db.select({ total: count() }).from(tableObj).where(whereClause);

  // Sorting
  const activeSort = sortRules.length > 0 ? sortRules : defaultSort ? [defaultSort] : [];
  const orderByClauses: SQL[] = [];
  for (const rule of activeSort) {
    const colObj = tableObj[rule.col];
    if (colObj) {
      orderByClauses.push(rule.ascending ? asc(colObj) : desc(colObj));
    }
  }

  // Projection selection
  let selection: Record<string, any> | undefined;
  if (select && select !== "*") {
    const cols = select
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    selection = {};
    for (const c of cols) {
      if (tableObj[c]) {
        selection[c] = tableObj[c];
      }
    }
  }

  let query = selection
    ? db.select(selection).from(tableObj).where(whereClause)
    : db.select().from(tableObj).where(whereClause);

  if (orderByClauses.length > 0) {
    query = (query as any).orderBy(...orderByClauses);
  }

  if (!isAll) {
    query = (query as any).limit(pagination.pageSize).offset(pagination.offset);
  }

  const data = await query;

  if (isAll) {
    return {
      data: (data ?? []) as TData[],
      totalCount: data?.length ?? 0,
      page: 1,
      pageSize: data?.length ?? 0,
      totalPages: 1,
    };
  }

  return formatPaginatedResponse<TData>(data as TData[] | null, total, pagination);
}

/**
 * Executes a standardized paginated entity query for Next.js route handlers, returning a NextResponse envelope.
 */
export async function executePaginatedEntityQuery<TCol extends string, TData = unknown>(
  options: PaginatedEntityQueryOptions<TCol>,
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(options.request.url);
    const result = await buildPaginatedEntityResult<TCol, TData>({
      ...options,
      searchParams,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
