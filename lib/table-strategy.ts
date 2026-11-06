import { z } from "zod";
import type { ColumnVisibilityState, SortingState, PaginationState } from "@tanstack/react-table";

export const DEFAULT_PAGE_SIZE = 15;

export interface BaseTableState {
  search: string;
  dateRange: { from?: string; to?: string } | undefined;
  sorting: SortingState;
  pagination: PaginationState;
  columnVisibility: ColumnVisibilityState;
  filters: Record<string, string>;
}

export const basePrunedStateSchema = z.object({
  search: z.string().optional(),
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

export type BasePrunedState = z.infer<typeof basePrunedStateSchema>;

export function pruneBaseState(state: BaseTableState): BasePrunedState {
  const pruned: BasePrunedState = {};

  if (state.search && state.search.trim() !== "") {
    pruned.search = state.search;
  }

  if (state.dateRange?.from) {
    pruned.dateRange = state.dateRange;
  }

  if (state.sorting && state.sorting.length > 0) {
    pruned.sorting = state.sorting;
  }

  if (
    state.pagination &&
    (state.pagination.pageIndex !== 0 || state.pagination.pageSize !== DEFAULT_PAGE_SIZE)
  ) {
    pruned.pagination = {
      ...(state.pagination.pageIndex !== 0 ? { pageIndex: state.pagination.pageIndex } : {}),
      ...(state.pagination.pageSize !== DEFAULT_PAGE_SIZE
        ? { pageSize: state.pagination.pageSize }
        : {}),
    };
  }

  if (state.columnVisibility && Object.keys(state.columnVisibility).length > 0) {
    pruned.columnVisibility = state.columnVisibility;
  }

  return pruned;
}

export function hydrateBaseState(
  pruned: BasePrunedState | undefined,
  defaultSorting: SortingState = [{ id: "id", desc: true }],
): BaseTableState {
  return {
    search: pruned?.search ?? "",
    dateRange: pruned?.dateRange,
    sorting: pruned?.sorting ?? defaultSorting,
    pagination: {
      pageIndex: pruned?.pagination?.pageIndex ?? 0,
      pageSize: pruned?.pagination?.pageSize ?? DEFAULT_PAGE_SIZE,
    },
    columnVisibility: pruned?.columnVisibility ?? {},
    filters: {},
  };
}

export interface TableStrategy<TState, TPruned> {
  schema: z.ZodType<TPruned>;
  defaultState: TState;
  prune: (state: TState) => TPruned;
  hydrate: (pruned?: TPruned) => TState;
}

/* -------------------------------------------------------------------------- */
/* Centers Table Strategy: Base capabilities + dateRange. No mode, no filters */
/* -------------------------------------------------------------------------- */

export type CentersTableState = BaseTableState;
export const centersPrunedSchema = basePrunedStateSchema.strict();
export type CentersPrunedState = z.infer<typeof centersPrunedSchema>;

export const centersStrategy: TableStrategy<CentersTableState, CentersPrunedState> = {
  schema: centersPrunedSchema,
  defaultState: hydrateBaseState(undefined, [{ id: "name", desc: false }]),
  prune: (state) => pruneBaseState(state),
  hydrate: (pruned) => hydrateBaseState(pruned, [{ id: "name", desc: false }]),
};

/* -------------------------------------------------------------------------- */
/* Users Table Strategy: Base capabilities + dateRange + filters. No mode     */
/* -------------------------------------------------------------------------- */

export type UsersTableState = BaseTableState;
export const usersPrunedSchema = basePrunedStateSchema
  .extend({
    filters: z.record(z.string(), z.string()).optional(),
  })
  .strict();
export type UsersPrunedState = z.infer<typeof usersPrunedSchema>;

export const usersStrategy: TableStrategy<UsersTableState, UsersPrunedState> = {
  schema: usersPrunedSchema,
  defaultState: hydrateBaseState(undefined, [{ id: "id", desc: true }]),
  prune: (state) => {
    const base = pruneBaseState(state);
    const pruned: UsersPrunedState = { ...base };
    if (state.filters && Object.keys(state.filters).length > 0) {
      pruned.filters = state.filters;
    }
    return pruned;
  },
  hydrate: (pruned) => ({
    ...hydrateBaseState(pruned, [{ id: "id", desc: true }]),
    filters: pruned?.filters ?? {},
  }),
};

/* -------------------------------------------------------------------------- */
/* Weighments Table Strategy: Base + dateRange + filters + mode               */
/* -------------------------------------------------------------------------- */

export interface WeighmentsTableState extends BaseTableState {
  mode: "automatic" | "manual";
}
export const weighmentsPrunedSchema = basePrunedStateSchema
  .extend({
    mode: z.enum(["automatic", "manual"]).optional(),
    filters: z.record(z.string(), z.string()).optional(),
  })
  .strict();
export type WeighmentsPrunedState = z.infer<typeof weighmentsPrunedSchema>;

export const weighmentsStrategy: TableStrategy<WeighmentsTableState, WeighmentsPrunedState> = {
  schema: weighmentsPrunedSchema,
  defaultState: {
    ...hydrateBaseState(undefined, [{ id: "id", desc: true }]),
    mode: "automatic",
  },
  prune: (state) => {
    const base = pruneBaseState(state);
    const pruned: WeighmentsPrunedState = { ...base };
    if (state.mode && state.mode !== "automatic") {
      pruned.mode = state.mode;
    }
    if (state.filters && Object.keys(state.filters).length > 0) {
      pruned.filters = state.filters;
    }
    return pruned;
  },
  hydrate: (pruned) => ({
    ...hydrateBaseState(pruned, [{ id: "id", desc: true }]),
    mode: pruned?.mode ?? "automatic",
    filters: pruned?.filters ?? {},
  }),
};

/* -------------------------------------------------------------------------- */
/* Declarative Table Registry                                                 */
/* -------------------------------------------------------------------------- */

export const TABLE_STRATEGIES = {
  centers: centersStrategy,
  users: usersStrategy,
  weighments: weighmentsStrategy,
} as const;

export type TableId = keyof typeof TABLE_STRATEGIES;

// Unified Table State bag for generic consumer compatibility
export type TableItemState = BaseTableState & {
  mode?: "automatic" | "manual";
};

export const DEFAULT_TABLE_ITEM_STATE: TableItemState = {
  search: "",
  dateRange: undefined,
  sorting: [{ id: "id", desc: true }],
  pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
  columnVisibility: {},
  filters: {},
};
