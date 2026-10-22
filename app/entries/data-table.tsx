"use client";

import { z } from "zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  DataTableContent,
  DataTablePagination,
  DataTableHydrationCard,
  useDataTable,
  type FacetedFilterOption,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, UserIcon } from "@hugeicons/core-free-icons";
import { appIcons } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { useDataTableStore } from "@/stores/use-data-table-store";
import { type TableItemState, getDualModeTableId } from "@/lib/table-cookie";
import {
  PhotosDialog,
  EntriesToolbar,
  EntriesErrorState,
  AutomaticEntryEditDialog,
  type EntriesFilterConfig,
} from "@/components/entries";
import { getColumns } from "./columns";
import { isManualEntry, type Entry, type EntryMode, type AutomaticEntry } from "./types";
import { type Center } from "@/app/centers/types";
import { type Customer } from "@/app/customers/types";
import { type User } from "@/app/users/types";

function formatCenterOptions(centers: Center[]): FacetedFilterOption[] {
  return [
    { label: "All Centers", value: "all", icon: appIcons.centers },
    ...centers.map((c) => ({
      idPrefix: `#${c.id}`,
      label: c.name,
      value: String(c.id),
    })),
  ];
}

function formatCustomerOptions(customers: Customer[]): FacetedFilterOption[] {
  return [
    { label: "All Customers", value: "all", icon: appIcons.customers },
    ...customers.map((u) => ({
      idPrefix: `#${u.id}`,
      label: u.name,
      value: String(u.id),
    })),
  ];
}

function formatCreatorOptions(creators: User[]): FacetedFilterOption[] {
  return [
    { label: "All Creators", value: "all", icon: appIcons.users },
    ...creators.map((u) => ({
      idPrefix: `#${u.id}`,
      label: u.name,
      value: String(u.id),
    })),
  ];
}

async function fetchFilterOptions() {
  const [centersRes, customersRes, creatorsRes] = await Promise.all([
    axios.get<{ data: Center[] }>("/api/centers?all=true&sort=name.asc"),
    axios.get<{ data: Customer[] }>("/api/customers?all=true&sort=name.asc"),
    axios.get<{ data: User[] }>("/api/users?all=true&sort=name.asc"),
  ]);
  return {
    centers: centersRes.data.data ?? [],
    customers: customersRes.data.data ?? [],
    creators: creatorsRes.data.data ?? [],
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
  customers: Customer[],
  creators: User[],
  onReset: (key: string) => void,
): { sanitizedFilters: Record<string, string>; needsFallback: boolean } {
  let needsFallback = false;
  const sanitizedFilters = { ...currentFilters };
  const dynamicEntityChecks: Array<{ key: string; validIds: Set<string> }> = [
    { key: "center_id", validIds: new Set(centers.map((c) => String(c.id))) },
    { key: "customer_id", validIds: new Set(customers.map((c) => String(c.id))) },
    { key: "creator", validIds: new Set(creators.map((c) => String(c.id))) },
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

function buildEntriesQueryParams(
  tableState: TableItemState,
  mode: EntryMode,
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

const ENTRY_MODE_ENDPOINTS: Record<EntryMode, string> = {
  automatic: "/api/entries/automatic",
  manual: "/api/entries/manual",
};

interface FilterOptionsBundle {
  centerOptions: FacetedFilterOption[];
  customerOptions: FacetedFilterOption[];
  creatorOptions: FacetedFilterOption[];
}

const MODE_FILTER_BUILDERS: Record<
  EntryMode,
  (opts: FilterOptionsBundle) => EntriesFilterConfig[]
> = {
  automatic: ({ centerOptions, customerOptions }) => [
    {
      key: "center_id",
      title: "Center",
      options: centerOptions,
      variant: "stone",
      categoryIcon: appIcons.centers,
    },
    {
      key: "customer_id",
      title: "Customer",
      options: customerOptions,
      variant: "emerald",
      categoryIcon: appIcons.customers,
    },
  ],
  manual: ({ centerOptions, customerOptions, creatorOptions }) => [
    {
      key: "center_id",
      title: "Center",
      options: centerOptions,
      variant: "stone",
      categoryIcon: appIcons.centers,
    },
    {
      key: "customer_id",
      title: "Customer",
      options: customerOptions,
      variant: "emerald",
      categoryIcon: appIcons.customers,
    },
    {
      key: "creator",
      title: "Creator",
      options: creatorOptions,
      variant: "primary",
      categoryIcon: UserIcon,
    },
  ],
};

export function EntriesDataTable() {
  const [centerOptions, setCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All Centers", value: "all", icon: appIcons.centers },
  ]);
  const [customerOptions, setCustomerOptions] = useState<FacetedFilterOption[]>([
    { label: "All Customers", value: "all", icon: appIcons.customers },
  ]);
  const [creatorOptions, setCreatorOptions] = useState<FacetedFilterOption[]>([
    { label: "All Creators", value: "all", icon: appIcons.users },
  ]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<
    { data: Entry[]; totalCount: number } | undefined
  >();

  const activeLoadIdRef = useRef<number>(0);
  const [selectedEntryForPhotos, setSelectedEntryForPhotos] = useState<Entry | null>(null);
  const [photosDialogOpen, setPhotosDialogOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<AutomaticEntry | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [entriesToDelete, setEntriesToDelete] = useState<Entry[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleViewPhotos = useCallback((entry: Entry) => {
    setSelectedEntryForPhotos(entry);
    setPhotosDialogOpen(true);
  }, []);

  const handleEditEntry = useCallback((entry: Entry) => {
    if (!isManualEntry(entry)) {
      setEditingEntry(entry);
      setEditDialogOpen(true);
    }
  }, []);

  const handleDeleteEntry = useCallback((entry: Entry) => {
    setEntriesToDelete([entry]);
    setDeleteDialogOpen(true);
  }, []);

  const tableMeta = useMemo(
    () => ({
      onViewPhotos: handleViewPhotos,
      onEditEntry: handleEditEntry,
      onDeleteEntry: handleDeleteEntry,
    }),
    [handleViewPhotos, handleEditEntry, handleDeleteEntry],
  );

  const fetchEntries = useCallback(async (queryParams: Record<string, unknown>) => {
    const modeKey = (queryParams.mode as EntryMode) ?? "automatic";
    const endpoint = ENTRY_MODE_ENDPOINTS[modeKey];
    const res = await axios.get<{ data: Entry[]; totalCount: number }>(endpoint, {
      params: queryParams,
    });
    return res.data;
  }, []);

  const loadInitialData = useCallback(async () => {
    const currentLoadId = ++activeLoadIdRef.current;
    setIsInitialLoading(true);
    setInitialError(null);
    try {
      const mode = useDataTableStore.getState().globalMode;
      const tableId = getDualModeTableId("entries", mode);
      const currentTableState = useDataTableStore.getState().getTableState(tableId);
      const initialQueryParams = buildEntriesQueryParams(currentTableState, mode);
      const initialEndpoint = ENTRY_MODE_ENDPOINTS[mode];

      const [optionsResult, entriesResult] = await Promise.all([
        fetchFilterOptions(),
        axios.get<{ data: Entry[]; totalCount: number }>(initialEndpoint, {
          params: initialQueryParams,
        }),
      ]);

      if (currentLoadId !== activeLoadIdRef.current) return;

      const { centers, customers, creators } = optionsResult;
      const { sanitizedFilters, needsFallback } = validateAndSanitizeFilters(
        currentTableState.filters,
        centers,
        customers,
        creators,
        (key) => useDataTableStore.getState().setTableFilter(tableId, key, "all"),
      );

      let finalEntries = entriesResult.data;
      if (needsFallback) {
        const sanitizedQueryParams = buildEntriesQueryParams(
          currentTableState,
          mode,
          1,
          sanitizedFilters,
        );
        const refetchRes = await axios.get<{ data: Entry[]; totalCount: number }>(initialEndpoint, {
          params: sanitizedQueryParams,
        });
        if (currentLoadId !== activeLoadIdRef.current) return;
        finalEntries = refetchRes.data;
      }

      setCenterOptions(formatCenterOptions(centers));
      setCustomerOptions(formatCustomerOptions(customers));
      setCreatorOptions(formatCreatorOptions(creators));
      setInitialData(finalEntries);
      setIsInitialLoading(false);
    } catch (err) {
      if (currentLoadId === activeLoadIdRef.current) {
        setInitialError(getErrorMessage(err, "Failed to load entries."));
        setIsInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const mode = useDataTableStore((state) => state.globalMode);
  const tableId = getDualModeTableId("entries", mode);

  const columns = useMemo(() => getColumns(mode), [mode]);
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
    setRowSelection,
    selectedRows,
    selectedCount,
  } = useDataTable<Entry>({
    tableId,
    columns,
    extraParams,
    fetchData: fetchEntries,
    meta: tableMeta,
    enabled: !isInitialLoading && !!initialData,
    initialData,
  });

  const handleBatchDelete = useCallback(() => {
    if (selectedCount === 0) return;
    setEntriesToDelete(selectedRows);
    setDeleteDialogOpen(true);
  }, [selectedCount, selectedRows]);

  const confirmDelete = async () => {
    if (entriesToDelete.length === 0) return;
    setIsDeleting(true);
    try {
      const endpoint = ENTRY_MODE_ENDPOINTS[mode];
      await axios.delete(endpoint, {
        data: { ids: entriesToDelete.map((e) => e.id) },
      });

      const isBatch = entriesToDelete.length > 1;
      toast.add({
        type: "success",
        title: isBatch ? "Entries deleted" : "Entry deleted",
        description: isBatch
          ? `Successfully deleted ${entriesToDelete.length} ${mode} entries.`
          : `Entry #${entriesToDelete[0].id} (${entriesToDelete[0].vehicle_number}) deleted successfully.`,
      });

      setRowSelection({});
      setDeleteDialogOpen(false);
      setEntriesToDelete([]);
      refresh();
    } catch (err: unknown) {
      toast.add({
        type: "error",
        title: "Deletion blocked",
        description: getErrorMessage(err, "Failed to delete entry."),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filterConfigs = useMemo<EntriesFilterConfig[]>(
    () => MODE_FILTER_BUILDERS[mode]({ centerOptions, customerOptions, creatorOptions }),
    [mode, centerOptions, customerOptions, creatorOptions],
  );

  if (isInitialLoading || !initialData) {
    return <DataTableHydrationCard />;
  }

  if (initialError) {
    return <EntriesErrorState error={initialError} onRetry={loadInitialData} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar - 2-Tier Layout with Integrated Multi-Sort */}
      <EntriesToolbar
        table={table}
        search={search}
        onSearchChange={setSearch}
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

      {/* Floating Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border/80 bg-muted/40 px-3 py-1.5 text-xs">
          <span className="font-medium text-muted-foreground">
            {selectedCount} entry{selectedCount > 1 ? "s" : ""} selected
          </span>
          <Button variant="destructive" size="xs" onClick={handleBatchDelete} className="gap-1.5">
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
            <span>Delete Selected</span>
          </Button>
        </div>
      )}

      {/* Reusable Data Table Content */}
      <DataTableContent table={table} loading={loading} error={error} onRetry={refresh} />

      {/* Permanently Anchored Bottom Pagination Bar */}
      <DataTablePagination table={table} loading={loading} />

      {/* Interactive Photo Carousel Modal */}
      {selectedEntryForPhotos && (
        <PhotosDialog
          open={photosDialogOpen}
          onOpenChange={setPhotosDialogOpen}
          title={`Entry #${selectedEntryForPhotos.id} Photos`}
          subtitle={
            selectedEntryForPhotos.center
              ? `${selectedEntryForPhotos.vehicle_number} • ${selectedEntryForPhotos.center.name}`
              : selectedEntryForPhotos.vehicle_number
          }
          images={selectedEntryForPhotos.images ?? []}
        />
      )}

      {/* Edit Automatic Entry Dialog */}
      <AutomaticEntryEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        entry={editingEntry}
        onSuccess={refresh}
      />

      {/* Delete Entry Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setEntriesToDelete([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md pb-3">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              </div>
              <DialogTitle>
                {entriesToDelete.length > 1
                  ? `Delete ${entriesToDelete.length} Entries`
                  : "Delete Entry"}
              </DialogTitle>
            </div>
            <DialogDescription>
              {entriesToDelete.length > 1
                ? `Are you sure you want to delete these ${entriesToDelete.length} entries? Entries with linked weighments or tickets cannot be deleted.`
                : entriesToDelete[0]
                  ? `Are you sure you want to delete entry #${entriesToDelete[0].id} (${entriesToDelete[0].vehicle_number})? Entries with linked weighments or tickets cannot be deleted.`
                  : "Confirm entry deletion."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteDialogOpen(false);
                setEntriesToDelete([]);
              }}
              disabled={isDeleting}
              className="h-8 gap-1.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
              disabled={isDeleting || entriesToDelete.length === 0}
              className="h-8 gap-1.5 text-xs"
            >
              {isDeleting ? (
                <Spinner className="size-3.5" data-icon="inline-start" />
              ) : (
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" data-icon="inline-start" />
              )}
              {entriesToDelete.length > 1
                ? `Delete ${entriesToDelete.length} Entries`
                : "Delete Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
