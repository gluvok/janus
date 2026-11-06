import {
  TABLE_STRATEGIES,
  type TableId,
  type TableItemState,
  DEFAULT_TABLE_ITEM_STATE,
  DEFAULT_PAGE_SIZE,
} from "./table-strategy";

export const TABLES_COOKIE_NAME = "mesto_tables_state";
export const TABLES_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export {
  TABLE_STRATEGIES,
  DEFAULT_TABLE_ITEM_STATE,
  DEFAULT_PAGE_SIZE,
  type TableId,
  type TableItemState,
};

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

/**
 * Prunes default/empty values to minimize cookie payload size using table strategies.
 * Delegates entirely to each table's registered strategy without ad-hoc if/else checks.
 */
export function pruneTableState(tables: Record<string, TableItemState>): Record<string, unknown> {
  const pruned: Record<string, unknown> = {};

  for (const [tableId, strategy] of Object.entries(TABLE_STRATEGIES)) {
    const state = tables[tableId];
    if (state) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prunedItem = strategy.prune(state as any);
      if (Object.keys(prunedItem as object).length > 0) {
        pruned[tableId] = prunedItem;
      }
    }
  }

  return pruned;
}

/**
 * Serializes pruned table states into a compact JSON string.
 */
export function serializeTablesCookie(tables: Record<string, TableItemState>): string {
  const pruned = pruneTableState(tables);
  return JSON.stringify(pruned);
}

/**
 * Safely parses cookie value into complete table states.
 * Delegates schema validation and state hydration directly to each table's registered strategy.
 */
export function parseTablesCookie(rawCookie?: string | null): Record<string, TableItemState> {
  if (!rawCookie) return {};

  const parsedJson = parseJsonString(rawCookie);
  if (!parsedJson || typeof parsedJson !== "object") return {};

  const rawRecord = parsedJson as Record<string, unknown>;
  const resultTables: Record<string, TableItemState> = {};

  for (const [tableId, strategy] of Object.entries(TABLE_STRATEGIES)) {
    const rawItem = rawRecord[tableId];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseResult = strategy.schema.safeParse(rawItem);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resultTables[tableId] = strategy.hydrate(
      parseResult.success ? (parseResult.data as any) : undefined,
    );
  }

  return resultTables;
}

/**
 * Writes the serialized table state to document.cookie in the browser.
 */
export function writeTablesCookie(tables: Record<string, TableItemState>): void {
  if (typeof document === "undefined") return;

  const serialized = serializeTablesCookie(tables);
  document.cookie = `${TABLES_COOKIE_NAME}=${encodeURIComponent(serialized)}; path=/; max-age=${TABLES_COOKIE_MAX_AGE}; SameSite=Lax`;
}
