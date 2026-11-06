"use client";

import { useState } from "react";
import {
  DataTableContent,
  DataTableHydrationCard,
  DataTablePagination,
  DataTableToolbar,
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
      <DataTableToolbar
        table={table}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search centers..."
        onRefresh={refresh}
        loading={loading}
        dateRange={dateRange}
        onDateRangeChange={(range) => {
          setDateRange(range);
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetAllFilters}
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
