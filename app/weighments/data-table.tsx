"use client";

import { z } from "zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  DataTableContent,
  DataTablePagination,
  DataTableHydrationCard,
  DataTableToolbar,
  DataTableErrorState,
  useDataTable,
  type FacetedFilterOption,
  type DataTableFilterConfig,
} from "@/components/data-table";
import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  Building02Icon,
  Building03Icon,
  CircleMinusIcon,
  Clock01Icon,
  Layers01Icon,
} from "@hugeicons/core-free-icons";
import { appIcons } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { useDataTableStore } from "@/stores/use-data-table-store";
import { type TableItemState, getDualModeTableId } from "@/lib/table-cookie";
import { PhotosDialog } from "@/components/photos-dialog";
import { getWeighmentColumns, type WeighmentsTableMeta } from "./columns";
import type { Weighment, WeighmentMode } from "./types";
import type { Center } from "@/app/centers/types";

const TYPE_OPTIONS: FacetedFilterOption[] = [
  { label: "All Types", value: "all", icon: Layers01Icon },
  { label: "PENDING", value: "pending", icon: Clock01Icon },
  { label: "IN", value: "in", icon: ArrowDownRight01Icon },
  { label: "OUT", value: "out", icon: ArrowUpRight01Icon },
  { label: "UNASSIGNED", value: "unassigned", icon: CircleMinusIcon },
];

function formatCenterOptions(centers: Center[], title: string): FacetedFilterOption[] {
  return [
    { label: `All ${title}`, value: "all", icon: appIcons.centers },
    ...centers.map((c) => ({
      idPrefix: `#${c.id}`,
      label: c.name,
      value: String(c.id),
    })),
  ];
}

async function fetchFilterOptions() {
  const centersRes = await axios.get<{ data: Center[] }>("/api/centers?all=true&sort=name.asc");
  return {
    centers: centersRes.data.data ?? [],
  };
}

function createFilterSanitizerSchema(validIds: Set<string>) {
  return z.string().transform((val) => {
    if (!val || val === "all") return "all";
    const ids = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const valid = ids.filter((id) => validIds.has(id));
    return valid.length === 0 ? "all" : valid.join(",");
  });
}

function validateAndSanitizeFilters(
  currentFilters: Record<string, string>,
  centers: Center[],
  onReset: (key: string) => void,
): { sanitizedFilters: Record<string, string>; needsFallback: boolean } {
  let needsFallback = false;
  const sanitizedFilters = { ...currentFilters };
  const dynamicEntityChecks: Array<{ key: string; validIds: Set<string> }> = [
    { key: "in_center_id", validIds: new Set(centers.map((c) => String(c.id))) },
    { key: "out_center_id", validIds: new Set(centers.map((c) => String(c.id))) },
  ];

  for (const { key, validIds } of dynamicEntityChecks) {
    const rawVal = sanitizedFilters[key];
    if (rawVal && rawVal !== "all") {
      const schema = createFilterSanitizerSchema(validIds);
      const parsed = schema.safeParse(rawVal);
      if (parsed.success) {
        if (parsed.data !== rawVal) {
          sanitizedFilters[key] = parsed.data;
          needsFallback = true;
          if (parsed.data === "all") {
            onReset(key);
          }
        }
      } else {
        sanitizedFilters[key] = "all";
        onReset(key);
        needsFallback = true;
      }
    }
  }

  return { sanitizedFilters, needsFallback };
}

function buildWeighmentsQueryParams(
  tableState: TableItemState,
  mode: WeighmentMode,
  pageOverride?: number,
  filtersOverride?: Record<string, string>,
): Record<string, unknown> {
  const pagination = tableState.pagination;
  const sorting = tableState.sorting;
  const search = tableState.search;
  const fromIso = tableState.dateRange?.from;
  const toIso = tableState.dateRange?.to;
  const filters = filtersOverride ?? tableState.filters;

  return {
    mode,
    page: pageOverride ?? pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    ...(sorting.length > 0 && {
      sort: sorting.map((s) => `${s.id}.${s.desc ? "desc" : "asc"}`).join(","),
    }),
    ...(search && { search }),
    ...(fromIso && { from: fromIso }),
    ...(toIso && { to: toIso }),
    ...filters,
  };
}

export function WeighmentsDataTable() {
  const [inCenterOptions, setInCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All In Centers", value: "all", icon: Building02Icon },
  ]);
  const [outCenterOptions, setOutCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All Out Centers", value: "all", icon: Building03Icon },
  ]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<
    { data: Weighment[]; totalCount: number } | undefined
  >();

  const activeLoadIdRef = useRef<number>(0);
  const [photosDialogState, setPhotosDialogState] = useState<{
    open: boolean;
    title: string;
    subtitle?: string;
    images: string[];
  }>({
    open: false,
    title: "",
    subtitle: undefined,
    images: [],
  });

  const handleViewPhotos = useCallback((title: string, subtitle: string, images: string[]) => {
    setPhotosDialogState({
      open: true,
      title,
      subtitle,
      images,
    });
  }, []);

  const tableMeta: WeighmentsTableMeta = useMemo(
    () => ({
      onViewPhotos: handleViewPhotos,
    }),
    [handleViewPhotos],
  );

  const fetchWeighments = useCallback(async (queryParams: Record<string, unknown>) => {
    const isManual = queryParams.mode === "manual";
    const endpoint = isManual ? "/api/weighments/manual" : "/api/weighments/automatic";
    const res = await axios.get<{ data: Weighment[]; totalCount: number }>(endpoint, {
      params: queryParams,
    });
    return res.data;
  }, []);

  const loadInitialData = useCallback(async () => {
    const currentLoadId = ++activeLoadIdRef.current;
    setIsInitialLoading(true);
    setInitialError(null);
    try {
      const mode = useDataTableStore.getState().globalMode as WeighmentMode;
      const tableId = getDualModeTableId("weighments", mode);
      const currentTableState = useDataTableStore.getState().getTableState(tableId);
      const initialQueryParams = buildWeighmentsQueryParams(currentTableState, mode);
      const initialEndpoint =
        mode === "manual" ? "/api/weighments/manual" : "/api/weighments/automatic";

      const [optionsResult, weighmentsResult] = await Promise.all([
        fetchFilterOptions(),
        axios.get<{ data: Weighment[]; totalCount: number }>(initialEndpoint, {
          params: initialQueryParams,
        }),
      ]);

      if (currentLoadId !== activeLoadIdRef.current) return;

      const { centers } = optionsResult;
      const { sanitizedFilters, needsFallback } = validateAndSanitizeFilters(
        currentTableState.filters,
        centers,
        (key) => useDataTableStore.getState().setTableFilter(tableId, key, "all"),
      );

      let finalWeighments = weighmentsResult.data;
      if (needsFallback) {
        const sanitizedQueryParams = buildWeighmentsQueryParams(
          currentTableState,
          mode,
          1,
          sanitizedFilters,
        );
        const refetchRes = await axios.get<{ data: Weighment[]; totalCount: number }>(
          initialEndpoint,
          { params: sanitizedQueryParams },
        );
        if (currentLoadId !== activeLoadIdRef.current) return;
        finalWeighments = refetchRes.data;
      }

      setInCenterOptions(formatCenterOptions(centers, "In Centers"));
      setOutCenterOptions(formatCenterOptions(centers, "Out Centers"));
      setInitialData(finalWeighments);
      setIsInitialLoading(false);
    } catch (err) {
      if (currentLoadId === activeLoadIdRef.current) {
        setInitialError(getErrorMessage(err, "Failed to load weighments."));
        setIsInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const mode = useDataTableStore((state) => state.globalMode) as WeighmentMode;
  const tableId = getDualModeTableId("weighments", mode);

  const columns = useMemo(() => getWeighmentColumns(), []);
  const extraParams = useMemo(() => ({ mode }), [mode]);

  const {
    table,
    loading,
    error,
    search,
    setSearch,
    dateRange,
    setDateRange,
    sorting,
    setSorting,
    removeSort,
    hasActiveSorts,
    resetAllCriteria,
    resetSorting,
    setFilter,
    refresh,
    tableState,
  } = useDataTable<Weighment>({
    tableId,
    columns,
    extraParams,
    fetchData: fetchWeighments,
    meta: tableMeta,
    enabled: !isInitialLoading && !!initialData,
    initialData,
  });

  const filterConfigs = useMemo<DataTableFilterConfig[]>(() => {
    return [
      {
        key: "type",
        title: "Type",
        options: TYPE_OPTIONS,
        variant: "orange",
        categoryIcon: Layers01Icon,
      },
      {
        key: "in_center_id",
        title: "In Center",
        options: inCenterOptions,
        variant: "stone",
        categoryIcon: Building02Icon,
      },
      {
        key: "out_center_id",
        title: "Out Center",
        options: outCenterOptions,
        variant: "stone",
        categoryIcon: Building03Icon,
      },
    ];
  }, [inCenterOptions, outCenterOptions]);

  if (isInitialLoading || !initialData) {
    return <DataTableHydrationCard />;
  }

  if (initialError) {
    return <DataTableErrorState title="Failed to load weighments" error={initialError} onRetry={loadInitialData} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar - 2-Tier Layout with Integrated Multi-Sort */}
      <DataTableToolbar
        table={table}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search weighments..."
        onRefresh={refresh}
        loading={loading}
        dateRange={dateRange}
        onDateRangeChange={(range) => setDateRange(range)}
        filterConfigs={filterConfigs}
        filters={tableState.filters}
        onFilterChange={(key, val) => setFilter(key, val)}
        hasActiveSorts={hasActiveSorts}
        sorting={sorting}
        onSortingChange={(updater) => setSorting(updater)}
        onRemoveSort={(columnId) => removeSort(columnId)}
        onResetSorts={resetSorting}
        onResetAll={resetAllCriteria}
      />

      {/* Reusable Data Table Content */}
      <DataTableContent table={table} loading={loading} error={error} onRetry={refresh} />

      {/* Permanently Anchored Bottom Pagination Bar */}
      <DataTablePagination table={table} loading={loading} />

      {/* Consolidated Photo Carousel Modal */}
      <PhotosDialog
        open={photosDialogState.open}
        onOpenChange={(open) => setPhotosDialogState((prev) => ({ ...prev, open }))}
        title={photosDialogState.title}
        subtitle={photosDialogState.subtitle}
        images={photosDialogState.images}
      />
    </div>
  );
}
