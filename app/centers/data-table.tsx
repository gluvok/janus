"use client";

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
import { Calendar01Icon, Clock01Icon, HashtagIcon, TextFontIcon } from "@hugeicons/core-free-icons";
import { columns } from "./columns";
import { type Center } from "./types";

const TABLE_ID = "centers";

const COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  name: "Name",
  created_at: "Created At",
  updated_at: "Updated At",
};

const COLUMN_ICONS: Record<string, unknown> = {
  id: HashtagIcon,
  name: TextFontIcon,
  created_at: Calendar01Icon,
  updated_at: Clock01Icon,
};

export function CentersDataTable() {
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
    resetAllCriteria,
    resetSorting,
    refresh,
  } = useDataTable<Center>({
    tableId: TABLE_ID,
    columns,
    endpoint: "/api/centers",
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

      {/* Active Criteria Bar (Drag-and-Drop Sort Priority Chips) */}
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
        columnLabels={COLUMN_LABELS}
        columnIcons={COLUMN_ICONS}
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
    </div>
  );
}
