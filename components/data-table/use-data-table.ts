"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  useTable,
  type ColumnVisibilityState,
  type PaginationState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type TableMeta,
  type TableOptions,
  type Updater,
} from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import { features, type DataTableFeatures } from "./data-table-features";
import { useDebounce } from "@/hooks/use-debounce";
import { getErrorMessage } from "@/lib/utils";
import {
  DEFAULT_TABLE_ITEM_STATE,
  useDataTableStore,
  useTableHydrated,
} from "@/stores/use-data-table-store";

export interface UseDataTableOptions<TData extends RowData> {
  tableId: string;
  columns: TableOptions<DataTableFeatures, TData>["columns"];
  endpoint?: string;
  extraParams?: Record<string, unknown>;
  fetchData?: (params: Record<string, unknown>) => Promise<{ data: TData[]; totalCount: number }>;
  meta?: TableMeta<DataTableFeatures, TData>;
  enabled?: boolean;
  initialData?: { data: TData[]; totalCount: number };
}

export function useDataTable<TData extends RowData>({
  tableId,
  columns,
  endpoint,
  extraParams,
  fetchData,
  meta,
  enabled = true,
  initialData,
}: UseDataTableOptions<TData>) {
  const hasHydrated = useTableHydrated();
  const store = useDataTableStore();
  const tableState = store.tables[tableId] ?? DEFAULT_TABLE_ITEM_STATE;

  const [data, setData] = useState<TData[]>(initialData?.data ?? []);
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0);
  const [loading, setLoading] = useState<boolean>(enabled && !initialData);
  const [error, setError] = useState<string | null>(null);
  const initialDataConsumedRef = useRef<boolean>(!!initialData);
  const requestIdRef = useRef<number>(0);

  // Sync state synchronously during render when initialData changes to eliminate 1-frame empty table flash
  const [prevInitialData, setPrevInitialData] = useState(initialData);
  if (initialData && initialData !== prevInitialData) {
    setPrevInitialData(initialData);
    setData(initialData.data);
    setTotalCount(initialData.totalCount);
    setLoading(false);
    initialDataConsumedRef.current = true;
  }

  const search = tableState.search;
  const fromIso = tableState.dateRange?.from;
  const toIso = tableState.dateRange?.to;

  const dateRange = useMemo<DateRange | undefined>(() => {
    if (!fromIso) return undefined;
    return {
      from: new Date(fromIso),
      to: toIso ? new Date(toIso) : undefined,
    };
  }, [fromIso, toIso]);

  const sorting = tableState.sorting;
  const pagination = tableState.pagination;
  const columnVisibility = tableState.columnVisibility;
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const debouncedSearch = useDebounce(search, 300);

  // Store action dispatchers
  const setSearch = useCallback(
    (val: string) => store.setTableSearch(tableId, val),
    [store, tableId],
  );
  const setFilter = useCallback(
    (key: string, val: string) => store.setTableFilter(tableId, key, val),
    [store, tableId],
  );
  const setDateRange = useCallback(
    (range: DateRange | undefined) =>
      store.setTableDateRange(
        tableId,
        range ? { from: range.from?.toISOString(), to: range.to?.toISOString() } : undefined,
      ),
    [store, tableId],
  );
  const setSorting = useCallback(
    (updater: Updater<SortingState>) => store.setTableSorting(tableId, updater),
    [store, tableId],
  );
  const removeSort = useCallback(
    (columnId: string) => store.removeTableSort(tableId, columnId),
    [store, tableId],
  );
  const resetSorting = useCallback(() => store.resetTableSorting(tableId), [store, tableId]);
  const setPagination = useCallback(
    (updater: Updater<PaginationState>) => store.setTablePagination(tableId, updater),
    [store, tableId],
  );
  const setColumnVisibility = useCallback(
    (updater: Updater<ColumnVisibilityState>) => store.setTableColumnVisibility(tableId, updater),
    [store, tableId],
  );
  const resetAllFilters = useCallback(() => store.resetTableFilters(tableId), [store, tableId]);
  const resetAllCriteria = useCallback(() => {
    store.resetTableFilters(tableId);
    store.resetTableSorting(tableId);
  }, [store, tableId]);

  // Serialized extraParams and filters string for dependency stability
  const extraParamsKey = useMemo(() => JSON.stringify(extraParams ?? {}), [extraParams]);
  const filtersKey = useMemo(() => JSON.stringify(tableState.filters ?? {}), [tableState.filters]);

  // Data fetching routine with sequence counter to prevent race conditions
  const fetchTableData = useCallback(async () => {
    const activeSearch = debouncedSearch;

    const queryParams: Record<string, unknown> = {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      ...(sorting.length > 0 && {
        sort: sorting.map((s) => `${s.id}.${s.desc ? "desc" : "asc"}`).join(","),
      }),
      ...(activeSearch && { search: activeSearch }),
      ...(fromIso && { from: fromIso }),
      ...(toIso && { to: toIso }),
      ...tableState.filters,
      ...extraParams,
    };

    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      if (fetchData) {
        const res = await fetchData(queryParams);
        if (currentRequestId === requestIdRef.current) {
          setData(res.data ?? []);
          setTotalCount(res.totalCount ?? 0);
        }
      } else if (endpoint) {
        const res = await axios.get<{ data: TData[]; totalCount: number }>(endpoint, {
          params: queryParams,
        });
        if (currentRequestId === requestIdRef.current) {
          setData(res.data.data ?? []);
          setTotalCount(res.data.totalCount ?? 0);
        }
      }
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        setError(getErrorMessage(err, "An unexpected error occurred."));
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    debouncedSearch,
    fromIso,
    toIso,
    endpoint,
    fetchData,
    filtersKey,
    extraParamsKey,
    tableState.filters,
    extraParams,
  ]);

  useEffect(() => {
    if (!hasHydrated || !enabled) return;
    if (initialDataConsumedRef.current) {
      initialDataConsumedRef.current = false;
      return;
    }
    fetchTableData();
  }, [hasHydrated, enabled, fetchTableData]);

  // Global app header refresh listener
  useEffect(() => {
    if (!hasHydrated || !enabled) return;
    const handleRefresh = () => {
      fetchTableData();
    };
    window.addEventListener("app:table-refresh", handleRefresh);
    return () => {
      window.removeEventListener("app:table-refresh", handleRefresh);
    };
  }, [hasHydrated, enabled, fetchTableData]);

  // TanStack table instance
  const table = useTable({
    features,
    data,
    columns,
    manualPagination: true,
    rowCount: totalCount,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: true,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    meta,
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
    },
  });

  const hasActiveSorts = sorting.length > 0;
  const hasActiveFilters = Boolean(
    dateRange?.from ||
    Object.entries(tableState.filters).some(([k, v]) => {
      if (extraParams && k in extraParams) return false;
      return v !== "all" && v !== "";
    }),
  );

  const selectedRows = useMemo(() => {
    return table.getSelectedRowModel().rows.map((r) => r.original);
  }, [table, rowSelection]);
  const selectedCount = selectedRows.length;

  return {
    table,
    data,
    totalCount,
    setData,
    setTotalCount,
    loading,
    error,
    hasHydrated,
    search,
    setSearch,
    debouncedSearch,
    dateRange,
    setDateRange,
    sorting,
    setSorting,
    removeSort,
    resetSorting,
    pagination,
    setPagination,
    columnVisibility,
    setColumnVisibility,
    rowSelection,
    setRowSelection,
    selectedRows,
    selectedCount,
    hasActiveSorts,
    hasActiveFilters,
    resetAllCriteria,
    resetAllFilters,
    setFilter,
    refresh: fetchTableData,
    tableState,
  };
}
