/**
 * @file lib/entries-query.ts
 * @description Shared backend query utilities for entries endpoints (/api/entries/automatic and /api/entries/manual).
 * Deduplicates search weight parsing, filter extraction, in-memory relational sorting, and pagination slicing using Drizzle ORM.
 */

import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { and, or, like, eq, inArray, gte, lte, count, type SQL } from "drizzle-orm";
import { db, schema } from "@/db/client";
import {
  parsePagination,
  parseSorting,
  dateQuerySchema,
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

export interface IdFilterDef {
  paramKeys: readonly string[];
  column: string;
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
      const getVal = (item: SortableEntry) =>
        getter
          ? getter(item)
          : String((item as unknown as Record<string, unknown>)[rule.col] ?? "");

      const valA = getVal(a);
      const valB = getVal(b);

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

const COMMON_ID_FILTERS: readonly IdFilterDef[] = [
  { paramKeys: ["center_id"], column: "center_id" },
  { paramKeys: ["customer_id"], column: "customer_id" },
];

const ENTRY_CONFIGS = {
  automatic: {
    table: schema.automatic_entries,
    allowedSortColumns: AUTOMATIC_SORT_COLUMNS,
    relationalSortCols: new Set(["center", "customer"]),
    idFilters: COMMON_ID_FILTERS,
    withQuery: {
      center: { columns: { id: true, name: true } },
      customer: { columns: { id: true, name: true } },
    },
  },
  manual: {
    table: schema.manual_entries,
    allowedSortColumns: MANUAL_SORT_COLUMNS,
    relationalSortCols: new Set(["center", "customer", "creator"]),
    idFilters: [
      ...COMMON_ID_FILTERS,
      { paramKeys: ["creator", "creator_id"], column: "creator_id" },
    ],
    withQuery: {
      center: { columns: { id: true, name: true } },
      customer: { columns: { id: true, name: true } },
      creator: { columns: { id: true, name: true, role: true } },
    },
  },
} as const;

/**
 * Executes entries query for /api/entries/automatic and /api/entries/manual,
 * handling search, common filters, date ranges, and relational sorting via Drizzle ORM.
 */
export async function executeEntriesGetQuery(
  request: Request,
  mode: "automatic" | "manual",
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const config = ENTRY_CONFIGS[mode];
    const targetTable: any = config.table;

    const sortRules = parseSorting(searchParams, config.allowedSortColumns, {
      col: "id",
      ascending: false,
    });

    const whereConditions: SQL[] = [];

    // Search query
    const search = searchParams.get("search")?.trim();
    if (search) {
      const numericVal = parseNumericWeight(search);
      if (numericVal !== null) {
        whereConditions.push(
          or(like(targetTable.vehicle_number, `%${search}%`), eq(targetTable.weight, numericVal))!,
        );
      } else {
        whereConditions.push(like(targetTable.vehicle_number, `%${search}%`));
      }
    }

    // ID filters (center_id, customer_id, creator_id)
    for (const { paramKeys, column } of config.idFilters) {
      const rawVal = paramKeys.map((k) => searchParams.get(k)?.trim()).find(Boolean);
      if (rawVal && rawVal !== "all") {
        const parsed = commaSeparatedIdsSchema.safeParse(rawVal);
        if (parsed.success && parsed.data.length > 0 && targetTable[column]) {
          whereConditions.push(inArray(targetTable[column], parsed.data));
        }
      }
    }

    // Date range filter
    const rawFrom = searchParams.get("from");
    if (rawFrom) {
      const parsed = dateQuerySchema.safeParse(rawFrom);
      if (parsed.success) {
        whereConditions.push(gte(targetTable.created_at, parsed.data.toISOString()));
      }
    }

    const rawTo = searchParams.get("to");
    if (rawTo) {
      const parsed = dateQuerySchema.safeParse(rawTo);
      if (parsed.success) {
        const toDate = new Date(parsed.data);
        toDate.setHours(23, 59, 59, 999);
        whereConditions.push(lte(targetTable.created_at, toDate.toISOString()));
      }
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Count query
    const [{ total }] = await db.select({ total: count() }).from(targetTable).where(whereClause);

    const hasRelationalSort = sortRules.some((r) => config.relationalSortCols.has(r.col));

    const buildRelationalWhere = (table: any, ops: any) => {
      const conditions = [];

      const search = searchParams.get("search")?.trim();
      if (search) {
        const numericVal = parseNumericWeight(search);
        const searchOrs = [ops.like(table.vehicle_number, `%${search}%`)];
        if ("detected_vehicle_number" in table) {
          searchOrs.push(ops.like(table.detected_vehicle_number, `%${search}%`));
        }
        if (numericVal !== null) {
          searchOrs.push(ops.eq(table.weight, numericVal));
        }
        conditions.push(ops.or(...searchOrs));
      }

      for (const { paramKeys, column } of config.idFilters) {
        const rawVal = paramKeys.map((k) => searchParams.get(k)?.trim()).find(Boolean);
        if (rawVal && rawVal !== "all") {
          const parsed = commaSeparatedIdsSchema.safeParse(rawVal);
          if (parsed.success && parsed.data.length > 0 && column in table) {
            conditions.push(ops.inArray(table[column], parsed.data));
          }
        }
      }

      const rawFrom = searchParams.get("from");
      if (rawFrom) {
        const parsed = dateQuerySchema.safeParse(rawFrom);
        if (parsed.success) {
          conditions.push(ops.gte(table.created_at, parsed.data.toISOString()));
        }
      }

      const rawTo = searchParams.get("to");
      if (rawTo) {
        const parsed = dateQuerySchema.safeParse(rawTo);
        if (parsed.success) {
          const toDate = new Date(parsed.data);
          toDate.setHours(23, 59, 59, 999);
          conditions.push(ops.lte(table.created_at, toDate.toISOString()));
        }
      }

      return conditions.length > 0 ? ops.and(...conditions) : undefined;
    };

    const hasFilters = whereConditions.length > 0;
    const whereOption = hasFilters ? { RAW: buildRelationalWhere } : undefined;

    if (hasRelationalSort) {
      const rows =
        mode === "automatic"
          ? await db.query.automatic_entries.findMany({
              ...(whereOption ? { where: whereOption } : {}),
              with: config.withQuery as any,
            })
          : await db.query.manual_entries.findMany({
              ...(whereOption ? { where: whereOption } : {}),
              with: config.withQuery as any,
            });

      const sorted = sortEntriesRelational(rows as unknown as SortableEntry[], sortRules);
      const sliced = paginateInMemory(sorted, pagination);

      return NextResponse.json(formatPaginatedResponse(sliced, total, pagination), {
        status: StatusCodes.OK,
      });
    }

    // Direct database sort referencing aliased table columns
    const orderByFn = (table: any, { asc, desc }: any) => {
      const clauses = [];
      for (const rule of sortRules) {
        if (rule.col in table) {
          clauses.push(rule.ascending ? asc(table[rule.col]) : desc(table[rule.col]));
        }
      }
      if (clauses.length === 0) {
        clauses.push(desc(table.id));
      }
      return clauses;
    };

    const rows =
      mode === "automatic"
        ? await db.query.automatic_entries.findMany({
            ...(whereOption ? { where: whereOption } : {}),
            with: config.withQuery as any,
            orderBy: orderByFn,
            limit: pagination.pageSize,
            offset: pagination.offset,
          })
        : await db.query.manual_entries.findMany({
            ...(whereOption ? { where: whereOption } : {}),
            with: config.withQuery as any,
            orderBy: orderByFn,
            limit: pagination.pageSize,
            offset: pagination.offset,
          });

    return NextResponse.json(
      formatPaginatedResponse(rows as unknown as SortableEntry[], total, pagination),
      { status: StatusCodes.OK },
    );
  } catch (error) {
    console.error(`GET /api/entries/${mode} error:`, error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export const deleteEntriesSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "At least one ID must be provided"),
});

/**
 * Handles hard deletion of entries with database-enforced ON DELETE RESTRICT foreign key protection.
 */
export async function executeEntriesDelete(
  request: Request,
  tableName: "automatic_entries" | "manual_entries",
): Promise<NextResponse> {
  try {
    const rawBody = await request.json();
    const validation = deleteEntriesSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { ids } = validation.data;
    const targetTable =
      tableName === "automatic_entries" ? schema.automatic_entries : schema.manual_entries;

    try {
      await db.delete(targetTable).where(inArray(targetTable.id, ids));
    } catch (err: unknown) {
      const errStr = String(err);
      if (
        errStr.includes("FOREIGN KEY") ||
        errStr.includes("constraint failed") ||
        (err as any)?.code === "SQLITE_CONSTRAINT"
      ) {
        return NextResponse.json(
          {
            error:
              "Cannot delete entry because linked operational records (weighments or tickets) exist.",
          },
          { status: StatusCodes.CONFLICT },
        );
      }
      throw err;
    }

    const modeLabel = tableName === "automatic_entries" ? "automatic" : "manual";
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${ids.length} ${modeLabel} entry record${ids.length > 1 ? "s" : ""}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
