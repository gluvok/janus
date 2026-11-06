"use client";

import type { ReactTable, RowData, SortingState, Updater } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DataTableSearchInput,
  DataTableFacetedFilter,
  DataTableRefreshButton,
  type FacetedFilterOption,
  DataTableViewOptions,
  DatePickerWithRange,
  type DataTableFeatures,
  DataTableCriteriaBar,
  DataTableClearButton,
} from "@/components/data-table";

export interface DataTableFilterConfig {
  key: string;
  title: string;
  options: FacetedFilterOption[];
  variant: "stone" | "emerald" | "orange" | "primary";
  categoryIcon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
}

export interface DataTableToolbarProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  onRefresh: () => void;
  loading?: boolean;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  filterConfigs?: DataTableFilterConfig[];
  filters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  hasActiveSorts: boolean;
  sorting: SortingState;
  onSortingChange: (updater: Updater<SortingState>) => void;
  onRemoveSort: (columnId: string) => void;
  onResetSorts?: () => void;
  onResetAll?: () => void;
}

export function DataTableToolbar<TData extends RowData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder = "Search records...",
  actions,
  onRefresh,
  loading,
  dateRange,
  onDateRangeChange,
  filterConfigs = [],
  filters = {},
  onFilterChange = () => {},
  hasActiveFilters,
  onResetFilters,
  hasActiveSorts,
  sorting,
  onSortingChange,
  onRemoveSort,
  onResetSorts,
  onResetAll,
}: DataTableToolbarProps<TData>) {
  return (
    <div className="flex flex-col gap-2 shrink-0">
      {/* Row 1: Search Box (Left) + Actions, Refresh Button & Columns (Right) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <DataTableSearchInput
            placeholder={searchPlaceholder}
            value={search}
            onChange={onSearchChange}
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {actions}
          <DataTableRefreshButton onClick={onRefresh} loading={loading} />
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Row 2: Date Picker (First Filter) + Filter Comboboxes + Clear Filters + Multi-Sort Priority Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <DatePickerWithRange date={dateRange} onDateChange={onDateRangeChange} />

        {filterConfigs.map((config) => (
          <DataTableFacetedFilter
            key={config.key}
            title={config.title}
            icon={config.categoryIcon}
            options={config.options}
            value={filters[config.key] ?? "all"}
            onValueChange={(val: string) => onFilterChange(config.key, val)}
          />
        ))}

        {hasActiveFilters && onResetFilters && (
          <DataTableClearButton label="Clear filters" onClick={onResetFilters} />
        )}

        <DataTableCriteriaBar
          hasActiveSorts={hasActiveSorts}
          sorting={sorting}
          onSortingChange={onSortingChange}
          onRemoveSort={onRemoveSort}
          onResetSorts={onResetSorts}
          onResetAll={onResetAll}
        />
      </div>
    </div>
  );
}
