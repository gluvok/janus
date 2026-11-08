import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ColumnVisibilityState,
  SortingState,
  PaginationState,
  Updater,
} from "@tanstack/react-table";
import {
  type TableItemState,
  type TableId,
  TABLE_STRATEGIES,
  DEFAULT_TABLE_ITEM_STATE,
} from "@/lib/table-strategy";

export type { TableItemState };
export { DEFAULT_TABLE_ITEM_STATE };

function resolveUpdater<T>(updaterOrValue: Updater<T>, previousValue: T): T {
  return typeof updaterOrValue === "function"
    ? (updaterOrValue as (old: T) => T)(previousValue)
    : updaterOrValue;
}

function getDefaultTableState(tableId: string): TableItemState {
  return TABLE_STRATEGIES[tableId as TableId]?.defaultState ?? DEFAULT_TABLE_ITEM_STATE;
}

interface DataTableStoreState {
  tables: Record<string, TableItemState>;
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setTableMode: (tableId: string, mode: "automatic" | "manual") => void;

  getTableState: (tableId: string) => TableItemState;
  setTableSearch: (tableId: string, search: string) => void;
  setTableFilter: (tableId: string, key: string, value: string) => void;
  setTableDateRange: (
    tableId: string,
    dateRange: { from?: string; to?: string } | undefined,
  ) => void;
  setTableSorting: (tableId: string, updaterOrValue: Updater<SortingState>) => void;
  removeTableSort: (tableId: string, columnId: string) => void;
  resetTableSorting: (tableId: string) => void;
  setTablePagination: (tableId: string, updaterOrValue: Updater<PaginationState>) => void;
  setTableColumnVisibility: (
    tableId: string,
    updaterOrValue: Updater<ColumnVisibilityState>,
  ) => void;
  resetTableFilters: (tableId: string) => void;
}

function updateTableState(
  state: DataTableStoreState,
  tableId: string,
  updater: (prev: TableItemState) => Partial<TableItemState>,
): { tables: Record<string, TableItemState> } {
  const prev = state.tables[tableId] ?? getDefaultTableState(tableId);
  const nextTables = {
    ...state.tables,
    [tableId]: {
      ...prev,
      ...updater(prev),
    },
  };
  return { tables: nextTables };
}

export const useDataTableStore = create<DataTableStoreState>()(
  persist(
    (set, get) => ({
      tables: {},
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),

      setTableMode: (tableId, mode) =>
        set((state) =>
          updateTableState(state, tableId, (prev) => ({
            mode,
            pagination: { ...prev.pagination, pageIndex: 0 },
          })),
        ),

      getTableState: (tableId) => get().tables[tableId] ?? getDefaultTableState(tableId),

      setTableSearch: (tableId, search) =>
        set((state) =>
          updateTableState(state, tableId, (prev) => ({
            search,
            pagination: { ...prev.pagination, pageIndex: 0 },
          })),
        ),

      setTableFilter: (tableId, key, value) =>
        set((state) =>
          updateTableState(state, tableId, (prev) => {
            const updatedFilters = { ...prev.filters };
            if (value === "all" || !value) {
              delete updatedFilters[key];
            } else {
              updatedFilters[key] = value;
            }
            return {
              filters: updatedFilters,
              pagination: { ...prev.pagination, pageIndex: 0 },
            };
          }),
        ),

      setTableDateRange: (tableId, dateRange) =>
        set((state) =>
          updateTableState(state, tableId, (prev) => ({
            dateRange,
            pagination: { ...prev.pagination, pageIndex: 0 },
          })),
        ),

      setTableSorting: (tableId, updaterOrValue) =>
        set((state) =>
          updateTableState(state, tableId, (prev) => ({
            sorting: resolveUpdater(updaterOrValue, prev.sorting),
          })),
        ),

      removeTableSort: (tableId, columnId) =>
        set((state) =>
          updateTableState(state, tableId, (prev) => ({
            sorting: prev.sorting.filter((s) => s.id !== columnId),
          })),
        ),

      resetTableSorting: (tableId) =>
        set((state) => updateTableState(state, tableId, () => ({ sorting: [] }))),

      setTablePagination: (tableId, updaterOrValue) =>
        set((state) =>
          updateTableState(state, tableId, (prev) => ({
            pagination: resolveUpdater(updaterOrValue, prev.pagination),
          })),
        ),

      setTableColumnVisibility: (tableId, updaterOrValue) =>
        set((state) =>
          updateTableState(state, tableId, (prev) => ({
            columnVisibility: resolveUpdater(updaterOrValue, prev.columnVisibility),
          })),
        ),

      resetTableFilters: (tableId) =>
        set((state) =>
          updateTableState(state, tableId, (prev) => ({
            search: "",
            filters: {},
            dateRange: undefined,
            pagination: { ...prev.pagination, pageIndex: 0 },
          })),
        ),
    }),
    {
      name: "mesto_tables_state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tables: state.tables }),
      onRehydrateStorage: (state) => {
        return () => {
          state.setHasHydrated(true);
        };
      },
    },
  ),
);

export function useTableHydrated() {
  return useDataTableStore((state) => state._hasHydrated);
}
