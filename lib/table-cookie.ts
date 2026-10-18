import { z } from "zod";
import type { ColumnVisibilityState, SortingState, PaginationState } from "@tanstack/react-table";

export const TABLES_COOKIE_NAME = "mesto_tables_state";
export const TABLES_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
export const DEFAULT_PAGE_SIZE = 15;

export const globalModeSchema = z.enum(["automatic", "manual"]);
export type GlobalMode = z.infer<typeof globalModeSchema>;

export interface TableItemState {
  search: string;
  filters: Record<string, string>;
  dateRange: { from?: string; to?: string } | undefined;
  sorting: SortingState;
  pagination: PaginationState;
  columnVisibility: ColumnVisibilityState;
}

export const DEFAULT_TABLE_ITEM_STATE: TableItemState = {
  search: "",
  filters: {},
  dateRange: undefined,
  sorting: [{ id: "id", desc: true }],
  pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
  columnVisibility: {},
};

export const prunedTableStateSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.string(), z.string()).optional(),
  dateRange: z.object({ from: z.string().optional(), to: z.string().optional() }).optional(),
  sorting: z.array(z.object({ id: z.string(), desc: z.boolean() })).optional(),
  pagination: z
    .object({
      pageIndex: z.number().int().nonnegative().optional(),
      pageSize: z.number().int().positive().optional(),
    })
    .optional(),
  columnVisibility: z.record(z.string(), z.boolean()).optional(),
});
export type PrunedTableState = z.infer<typeof prunedTableStateSchema>;

export const dualModeEntitySchema = z.object({
  automatic: prunedTableStateSchema.optional(),
  manual: prunedTableStateSchema.optional(),
});
export type DualModeEntityState = z.infer<typeof dualModeEntitySchema>;

/**
 * Smart-grouped cookie payload schema.
 * Dual-mode entities (entries, weighments, tickets) have 'automatic' and 'manual' subkeys.
 * Single-mode entities (centers, users, customers) store table preferences directly.
 * Root 'mode' governs global platform mode and Home ('/').
 */
export const tablesCookiePayloadSchema = z.object({
  mode: globalModeSchema,
  entries: dualModeEntitySchema.optional(),
  weighments: dualModeEntitySchema.optional(),
  tickets: dualModeEntitySchema.optional(),
  centers: prunedTableStateSchema.optional(),
  users: prunedTableStateSchema.optional(),
  customers: prunedTableStateSchema.optional(),
});
export type TablesCookiePayload = z.infer<typeof tablesCookiePayloadSchema>;

export const DEFAULT_TABLES_COOKIE: TablesCookiePayload = {
  mode: "automatic",
  entries: { automatic: {}, manual: {} },
  weighments: { automatic: {}, manual: {} },
  tickets: { automatic: {}, manual: {} },
  centers: {},
  users: {},
  customers: {},
};

/**
 * Checks whether a given pathname belongs to a dual-mode route.
 * Derives dynamic status directly from DEFAULT_TABLES_COOKIE schema definition:
 * if the entity contains 'automatic' and 'manual' subkeys, it has dual mode.
 * Home ('/') uses the root mode.
 */
export function isDualModeRoute(pathname: string | null | undefined): boolean {
  if (!pathname || pathname === "/") return pathname === "/";
  const route = pathname.slice(1);
  const entry = (DEFAULT_TABLES_COOKIE as Record<string, unknown>)[route];
  return typeof entry === "object" && entry !== null && "automatic" in entry;
}

/**
 * Derives the partitioned tableId for any dual-mode entity.
 * e.g., getDualModeTableId("entries", "manual") => "entries_manual"
 */
export function getDualModeTableId(baseTableName: string, mode: GlobalMode): string {
  return `${baseTableName}_${mode}`;
}

/**
 * Prunes default/empty values to minimize cookie payload size.
 */
export function pruneTableState(
  tables: Record<string, TableItemState>,
): Record<string, PrunedTableState> {
  const pruned: Record<string, PrunedTableState> = {};

  for (const [tableId, state] of Object.entries(tables)) {
    const item: PrunedTableState = {};

    if (state.search && state.search.trim() !== "") {
      item.search = state.search;
    }

    if (state.filters && Object.keys(state.filters).length > 0) {
      item.filters = state.filters;
    }

    if (state.dateRange?.from) {
      item.dateRange = state.dateRange;
    }

    if (state.sorting && state.sorting.length > 0) {
      item.sorting = state.sorting;
    }

    if (
      state.pagination &&
      (state.pagination.pageIndex !== 0 || state.pagination.pageSize !== DEFAULT_PAGE_SIZE)
    ) {
      item.pagination = {
        ...(state.pagination.pageIndex !== 0 ? { pageIndex: state.pagination.pageIndex } : {}),
        ...(state.pagination.pageSize !== DEFAULT_PAGE_SIZE
          ? { pageSize: state.pagination.pageSize }
          : {}),
      };
    }

    if (state.columnVisibility && Object.keys(state.columnVisibility).length > 0) {
      item.columnVisibility = state.columnVisibility;
    }

    if (Object.keys(item).length > 0) {
      pruned[tableId] = item;
    }
  }

  return pruned;
}

/**
 * Serializes pruned table states and active global mode into a compact smart-grouped JSON string.
 */
export function serializeTablesCookie(
  tables: Record<string, TableItemState>,
  globalMode: GlobalMode,
): string {
  const pruned = pruneTableState(tables);
  const payload: TablesCookiePayload = {
    mode: globalMode,
    entries: {
      ...(pruned["entries_automatic"] ? { automatic: pruned["entries_automatic"] } : {}),
      ...(pruned["entries_manual"] ? { manual: pruned["entries_manual"] } : {}),
    },
    weighments: {
      ...(pruned["weighments_automatic"] ? { automatic: pruned["weighments_automatic"] } : {}),
      ...(pruned["weighments_manual"] ? { manual: pruned["weighments_manual"] } : {}),
    },
    tickets: {
      ...(pruned["tickets_automatic"] ? { automatic: pruned["tickets_automatic"] } : {}),
      ...(pruned["tickets_manual"] ? { manual: pruned["tickets_manual"] } : {}),
    },
    ...(pruned["centers"] ? { centers: pruned["centers"] } : {}),
    ...(pruned["users"] ? { users: pruned["users"] } : {}),
    ...(pruned["customers"] ? { customers: pruned["customers"] } : {}),
  };
  return JSON.stringify(payload);
}

export interface ParsedTablesCookieResult {
  tables: Record<string, TableItemState>;
  globalMode: GlobalMode;
}

function parseJsonString(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    if (raw.startsWith("%7B") || raw.startsWith("%7b") || raw.includes("%")) {
      try {
        return JSON.parse(decodeURIComponent(raw));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function hydrateState(pruned?: PrunedTableState): TableItemState {
  if (!pruned) return DEFAULT_TABLE_ITEM_STATE;
  return {
    ...DEFAULT_TABLE_ITEM_STATE,
    ...(pruned.search ? { search: pruned.search } : {}),
    ...(pruned.filters ? { filters: pruned.filters } : {}),
    ...(pruned.dateRange ? { dateRange: pruned.dateRange } : {}),
    ...(pruned.sorting ? { sorting: pruned.sorting } : {}),
    ...(pruned.columnVisibility ? { columnVisibility: pruned.columnVisibility } : {}),
    pagination: {
      pageIndex: pruned.pagination?.pageIndex ?? 0,
      pageSize: pruned.pagination?.pageSize ?? DEFAULT_PAGE_SIZE,
    },
  };
}

/**
 * Safely parses cookie value (from server cookies() or document.cookie)
 * into a complete Record<string, TableItemState> and active global mode.
 * Strictly enforces target schema: returns clean default state on parse failure with zero legacy fallbacks.
 */
export function parseTablesCookie(rawCookie?: string | null): ParsedTablesCookieResult {
  const defaultResult: ParsedTablesCookieResult = {
    tables: {},
    globalMode: "automatic",
  };

  if (!rawCookie) return defaultResult;

  const parsedJson = parseJsonString(rawCookie);
  if (!parsedJson) return defaultResult;

  const parseResult = tablesCookiePayloadSchema.safeParse(parsedJson);
  if (!parseResult.success) return defaultResult;

  const { mode, entries, weighments, tickets, centers, users, customers } = parseResult.data;
  const resultTables: Record<string, TableItemState> = {};

  if (entries?.automatic) resultTables["entries_automatic"] = hydrateState(entries.automatic);
  if (entries?.manual) resultTables["entries_manual"] = hydrateState(entries.manual);
  if (weighments?.automatic)
    resultTables["weighments_automatic"] = hydrateState(weighments.automatic);
  if (weighments?.manual) resultTables["weighments_manual"] = hydrateState(weighments.manual);
  if (tickets?.automatic) resultTables["tickets_automatic"] = hydrateState(tickets.automatic);
  if (tickets?.manual) resultTables["tickets_manual"] = hydrateState(tickets.manual);
  if (centers) resultTables["centers"] = hydrateState(centers);
  if (users) resultTables["users"] = hydrateState(users);
  if (customers) resultTables["customers"] = hydrateState(customers);

  return {
    tables: resultTables,
    globalMode: mode,
  };
}

/**
 * Writes the serialized table state to document.cookie in the browser.
 */
export function writeTablesCookie(
  tables: Record<string, TableItemState>,
  globalMode: GlobalMode,
): void {
  if (typeof document === "undefined") return;

  const serialized = serializeTablesCookie(tables, globalMode);
  document.cookie = `${TABLES_COOKIE_NAME}=${encodeURIComponent(serialized)}; path=/; max-age=${TABLES_COOKIE_MAX_AGE}; SameSite=Lax`;
}
