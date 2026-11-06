"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  DataTableContent,
  DataTableCriteriaBar,
  DataTableHydrationCard,
  DataTablePagination,
  DataTableSearchInput,
  DataTableRefreshButton,
  DataTableViewOptions,
  DatePickerWithRange,
  useDataTable,
} from "@/components/data-table";
import { columns } from "./columns";
import { CenterEditDialog } from "./edit-dialog";
import { type Center } from "./types";

const TABLE_ID = "centers";

export function CentersDataTable() {
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);

  const {
    table,
    loading,
    error,
    hasHydrated,
    search,
    setSearch,
    dateRange,
    setDateRange,
    sorting,
    setSorting,
    removeSort,
    setPagination,
    hasActiveSorts,
    hasActiveFilters,
    resetAllCriteria,
    resetAllFilters,
    resetSorting,
    refresh,
  } = useDataTable<Center>({
    tableId: TABLE_ID,
    columns,
    endpoint: "/api/centers",
    meta: {
      onEditCenter: setEditingCenter,
    },
  });

  if (!hasHydrated) {
    return <DataTableHydrationCard />;
  }

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar */}
      <div className="flex flex-col gap-2 shrink-0 sm:flex-row sm:items-center sm:justify-between">
        {/* Filters Group (Left) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
          {/* Search Input with Clear Button */}
          <DataTableSearchInput
            placeholder="Search centers..."
            value={search}
            onChange={setSearch}
          />
        </div>

        {/* Action Controls Group (Right) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <DataTableRefreshButton onClick={refresh} loading={loading} />
          <DatePickerWithRange
            date={dateRange}
            onDateChange={(range) => {
              setDateRange(range);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="flex-1 sm:flex-initial"
          />

          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Row 2: Active Criteria Bar + Clear Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetAllFilters}
            className="h-7 gap-1 px-2 text-2xs text-muted-foreground hover:bg-stone-500/10 hover:text-foreground shrink-0 cursor-pointer"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3" data-icon="inline-start" />
            <span>Clear filters</span>
          </Button>
        )}

        <DataTableCriteriaBar
          hasActiveSorts={hasActiveSorts}
          sorting={sorting}
          onSortingChange={(updater) => {
            setSorting(updater);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          onRemoveSort={(columnId) => {
            removeSort(columnId);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          onResetSorts={resetSorting}
          onResetAll={resetAllCriteria}
        />
      </div>

      {/* Reusable Data Table Content */}
      <DataTableContent
        table={table}
        loading={loading}
        error={error}
        onRetry={refresh}
        emptyMessage="No centers found matching the specified filters."
      />

      {/* Pagination Controls */}
      <div className="shrink-0">
        <DataTablePagination table={table} loading={loading} error={error} />
      </div>

      {/* Center Edit Dialog */}
      {editingCenter && (
        <CenterEditDialog
          open={true}
          onOpenChange={(open) => !open && setEditingCenter(null)}
          center={editingCenter}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
