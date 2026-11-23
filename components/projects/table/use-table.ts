"use client";

/**
 * @file components/projects/table/use-table.ts
 * @description Hook managing state (sorting, filters, pagination, column preferences, row selection) for dynamic tables.
 * Column visibility and filter preferences are persisted to localStorage via usePreferencesStore.
 */

import React from "react";
import { useSearchParams } from "next/navigation";
import { type EntityRecord } from "@/types";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { useTable } from "@/lib/utils";
import { projectTableFeatures, type ProjectTableFeatures } from "@/components/data-table/features";
import { getProjectColumns } from "@/components/projects/columns";
import { ProjectSlug } from "@/lib/constants/enums";
import {
  useProjectDialogStates,
  parseColumnFilters,
  areFiltersEqual,
  getVisibleColumnsList,
  isStringArrayEqual,
} from "./use-helpers";
import { useAuthStore, getPermissions, useEntitiesStore, usePreferencesStore } from "@/lib/store";
import { fetchEntityListPaginated } from "@/lib/services";

/** Stable empty object — avoids creating a new reference on every render in Zustand selectors */
const EMPTY_FILTERS: Record<string, unknown> = {};

/** Computes initial or updated column visibility map based on saved preferences */
function computeColumnVisibility(
  columns: ColumnDef<ProjectTableFeatures, EntityRecord>[],
  savedVisibleColumns?: string[],
): ColumnVisibilityState {
  if (!savedVisibleColumns) return {};
  const visibility: ColumnVisibilityState = {};
  columns.forEach((col) => {
    const colId = col.id || ("accessorKey" in col ? String(col.accessorKey) : undefined);
    if (colId) {
      visibility[colId] =
        colId === "actions" || colId === "select" ? true : savedVisibleColumns.includes(colId);
    }
  });
  return visibility;
}

interface UseProjectTableProps {
  projectSlug: string;
  primaryIdKey: string;
  projectName: string;
}

/**
 * useProjectTable Hook
 * Manages queries, page indexes, column visibility states, and connects tables to TanStack Table instance.
 */
export function useProjectTable({ projectSlug, primaryIdKey, projectName }: UseProjectTableProps) {
  const dialogStates = useProjectDialogStates();
  const user = useAuthStore((state) => state.user);

  const username = user?.username;
  const prefKey = username ? `${username}:${projectSlug}` : projectSlug;

  // Preferences state & selectors from Zustand localStorage-backed store (username-scoped)
  const savedFilters = usePreferencesStore(
    (state) => state.filters[prefKey] ?? state.filters[projectSlug] ?? EMPTY_FILTERS,
  );
  const savedVisibleColumns = usePreferencesStore(
    (state) => state.columns[prefKey] ?? state.columns[projectSlug],
  );
  const setColumnPreferences = usePreferencesStore((state) => state.setColumnPreferences);
  const setFilterPreferences = usePreferencesStore((state) => state.setFilterPreferences);

  // Local table controls state
  const [sorting, setSorting] = React.useState<SortingState>(() => [
    { id: "created_at", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(() =>
    Object.entries(savedFilters).map(([id, value]) => ({ id, value })),
  );
  const [rowSelection, setRowSelection] = React.useState({});
  const searchParams = useSearchParams();
  const [globalFilter, setGlobalFilter] = React.useState(() => searchParams.get("search") ?? "");
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const { setEditingItem, setDeletingItem } = dialogStates;

  // Sync initial saved filters when rehydrated
  const hasSyncedInitialFilters = React.useRef(Object.keys(savedFilters).length > 0);
  React.useEffect(() => {
    if (!hasSyncedInitialFilters.current && Object.keys(savedFilters).length > 0) {
      setColumnFilters(Object.entries(savedFilters).map(([id, value]) => ({ id, value })));
      hasSyncedInitialFilters.current = true;
    }
  }, [savedFilters]);

  // Persist filter changes to store
  React.useEffect(() => {
    const filtersObj = parseColumnFilters(columnFilters);
    if (!areFiltersEqual(filtersObj, savedFilters)) {
      setFilterPreferences(projectSlug, filtersObj, username);
    }
  }, [columnFilters, projectSlug, savedFilters, setFilterPreferences, username]);

  // Table columns & permissions calculation
  const permissions = React.useMemo(
    () => getPermissions(user?.role, projectSlug),
    [user?.role, projectSlug],
  );

  const columns = React.useMemo<ColumnDef<ProjectTableFeatures, EntityRecord>[]>(() => {
    return getProjectColumns(
      projectSlug,
      primaryIdKey,
      projectName,
      {
        onEdit: setEditingItem,
        onDelete: setDeletingItem,
      },
      permissions,
    );
  }, [projectSlug, primaryIdKey, projectName, setEditingItem, setDeletingItem, permissions]);

  // Column visibility state synchronization
  const initialColumnVisibility = React.useMemo(
    () => computeColumnVisibility(columns, savedVisibleColumns),
    [savedVisibleColumns, columns],
  );

  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState | null>(
    null,
  );
  const effectiveColumnVisibility = columnVisibility ?? initialColumnVisibility;
  const handleColumnVisibilityChange = React.useCallback<OnChangeFn<ColumnVisibilityState>>(
    (updater) => {
      setColumnVisibility(
        typeof updater === "function"
          ? (current) => updater(current ?? initialColumnVisibility)
          : updater,
      );
    },
    [initialColumnVisibility],
  );

  // Data fetching & search debouncing
  const [localData, setLocalData] = React.useState<EntityRecord[]>([]);
  const [localCount, setLocalCount] = React.useState(0);
  const [localLoading, setLocalLoading] = React.useState(true);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [debouncedFilter, setDebouncedFilter] = React.useState(globalFilter);

  const entitiesUpdatedTrigger = useEntitiesStore((state) => state.entitiesUpdatedTrigger);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilter(globalFilter);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);

    return () => clearTimeout(handler);
  }, [globalFilter]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLocalLoading(true);
        setLocalError(null);
        const filtersObj = parseColumnFilters(columnFilters);

        const effectiveSortColumn = sorting[0]?.id || "created_at";
        const effectiveSortDesc = sorting[0] !== undefined ? sorting[0].desc : true;

        const result = await fetchEntityListPaginated(projectSlug as ProjectSlug, {
          page: pagination.pageIndex,
          pageSize: pagination.pageSize,
          sortColumn: effectiveSortColumn,
          sortDesc: effectiveSortDesc,
          search: debouncedFilter,
          filters: filtersObj,
        });

        if (!cancelled) {
          setLocalData(result.data);
          setLocalCount(result.count);
        }
      } catch (err) {
        if (err instanceof Error && err.message === "Unauthorized") {
          return;
        }
        console.error(`Failed to load paginated ${projectSlug}:`, err);
        if (!cancelled) {
          setLocalError(err instanceof Error ? err.message : `Failed to load ${projectName}`);
        }
      } finally {
        if (!cancelled) setLocalLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [
    projectSlug,
    projectName,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    debouncedFilter,
    columnFilters,
    entitiesUpdatedTrigger,
  ]);

  // TanStack Table Instance
  const table = useTable({
    features: projectTableFeatures,
    data: localData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount: localCount,
    pageCount: Math.ceil(localCount / pagination.pageSize),
    state: {
      sorting,
      columnFilters,
      columnVisibility: effectiveColumnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
  });

  // Persist column visibility changes to store
  React.useEffect(() => {
    const visibleColumnsList = getVisibleColumnsList(table);
    if (!isStringArrayEqual(savedVisibleColumns, visibleColumnsList)) {
      setColumnPreferences(projectSlug, visibleColumnsList, username);
    }
  }, [
    effectiveColumnVisibility,
    projectSlug,
    savedVisibleColumns,
    table,
    setColumnPreferences,
    username,
  ]);

  const handleReload = React.useCallback(() => {
    useEntitiesStore.getState().triggerEntitiesUpdate();
  }, []);

  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 0);
    return () => clearTimeout(timer);
  }, []);

  return {
    table,
    isLoading: localLoading,
    error: localError,
    isReady,
    permissions,
    handleReload,
    ...dialogStates,
  };
}
