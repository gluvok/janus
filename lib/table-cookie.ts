import type { ColumnVisibilityState, SortingState, PaginationState } from "@tanstack/react-table";

export const TABLES_COOKIE_NAME = "gluvok_tables_state";
export const TABLES_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type GlobalMode = "automatic" | "manual";
export type EntryMode = GlobalMode;

/**
 * Derives the partitioned tableId for any dual-mode entity.
 * e.g., getDualModeTableId("entries", "manual") => "entries_manual"
 * e.g., getDualModeTableId("weighments", "automatic") => "weighments_automatic"
 * e.g., getDualModeTableId("tickets", "manual") => "tickets_manual"
 */
export function getDualModeTableId(baseTableName: string, mode: GlobalMode): string {
  return `${baseTableName}_${mode}`;
}

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
  sorting: [],
  pagination: { pageIndex: 0, pageSize: 15 },
  columnVisibility: {},
};

export type PrunedTableState = Partial<{
  search: string;
  filters: Record<string, string>;
  dateRange: { from?: string; to?: string };
  sorting: SortingState;
  pagination: Partial<PaginationState>;
  columnVisibility: ColumnVisibilityState;
}>;

export interface SerializedCookiePayload {
  globalMode?: GlobalMode;
  mode?: GlobalMode;
  tables: Record<string, PrunedTableState>;
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
      (state.pagination.pageIndex !== 0 || state.pagination.pageSize !== 15)
    ) {
      item.pagination = {
        ...(state.pagination.pageIndex !== 0 ? { pageIndex: state.pagination.pageIndex } : {}),
        ...(state.pagination.pageSize !== 15 ? { pageSize: state.pagination.pageSize } : {}),
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
 * Serializes pruned table states and active global mode into a compact JSON string.
 */
export function serializeTablesCookie(
  tables: Record<string, TableItemState>,
  globalMode: GlobalMode = "automatic",
): string {
  const pruned = pruneTableState(tables);
  const payload: SerializedCookiePayload = {
    globalMode,
    tables: pruned,
  };
  return JSON.stringify(payload);
}

export interface ParsedTablesCookieResult {
  tables: Record<string, TableItemState>;
  globalMode: GlobalMode;
}

/**
 * Safely parses cookie value (from server cookies() or document.cookie)
 * into a complete Record<string, TableItemState> and active global mode.
 */
export function parseTablesCookie(rawCookie?: string | null): ParsedTablesCookieResult {
  const defaultResult: ParsedTablesCookieResult = {
    tables: {},
    globalMode: "automatic",
  };

  if (!rawCookie) return defaultResult;

  try {
    const decoded = rawCookie.includes("%") ? decodeURIComponent(rawCookie) : rawCookie;
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") return defaultResult;

    const rawTables =
      "tables" in parsed && typeof parsed.tables === "object" && parsed.tables !== null
        ? (parsed.tables as Record<string, PrunedTableState>)
        : (parsed as Record<string, PrunedTableState>);

    const rawGlobalMode = parsed.globalMode ?? parsed.mode;
    const globalMode: GlobalMode = rawGlobalMode === "manual" ? "manual" : "automatic";

    const resultTables: Record<string, TableItemState> = {};
    for (const [tableId, pruned] of Object.entries(rawTables)) {
      if (!pruned || typeof pruned !== "object") continue;
      resultTables[tableId] = {
        ...DEFAULT_TABLE_ITEM_STATE,
        ...(pruned.search ? { search: pruned.search } : {}),
        ...(pruned.filters ? { filters: pruned.filters } : {}),
        ...(pruned.dateRange ? { dateRange: pruned.dateRange } : {}),
        ...(pruned.sorting ? { sorting: pruned.sorting } : {}),
        ...(pruned.columnVisibility ? { columnVisibility: pruned.columnVisibility } : {}),
        pagination: {
          pageIndex: pruned.pagination?.pageIndex ?? 0,
          pageSize: pruned.pagination?.pageSize ?? 15,
        },
      };
    }

    return {
      tables: resultTables,
      globalMode,
    };
  } catch {
    return defaultResult;
  }
}

/**
 * Writes the serialized table state to document.cookie in the browser.
 */
export function writeTablesCookie(
  tables: Record<string, TableItemState>,
  globalMode: GlobalMode = "automatic",
): void {
  if (typeof document === "undefined") return;

  const serialized = serializeTablesCookie(tables, globalMode);
  document.cookie = `${TABLES_COOKIE_NAME}=${encodeURIComponent(serialized)}; path=/; max-age=${TABLES_COOKIE_MAX_AGE}; SameSite=Lax`;
}
