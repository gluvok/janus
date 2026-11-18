"use client";

import * as React from "react";
import type { ReactTable, RowData, SortingState, Updater } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import { HugeiconsIcon } from "@hugeicons/react";
import { type DataTableFeatures } from "./data-table-features";
import { DataTableSearchInput } from "./data-table-search-input";
import { DataTableRefreshButton } from "./data-table-refresh-button";
import { DataTableViewOptions } from "./data-table-view-options";
import { DataTableFacetedFilter, type FacetedFilterOption } from "./data-table-faceted-filter";
import { DataTableClearButton } from "./data-table-clear-button";
import { DataTableCriteriaBar } from "./data-table-criteria-bar";
import { DatePickerWithRange } from "./date-range-picker";
import type { UseDataTableReturn } from "./use-data-table";

export interface DataTableFilterConfig {
  key: string;
  title: string;
  options: FacetedFilterOption[];
  variant: "stone" | "emerald" | "orange" | "primary";
  categoryIcon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
}

export interface DataTableToolbarProps<TData extends RowData> {
  instance?: UseDataTableReturn<TData>;
  table?: ReactTable<DataTableFeatures, TData>;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
  dateRange?: DateRange | undefined;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  filterConfigs?: DataTableFilterConfig[];
  filters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  hasActiveSorts?: boolean;
  sorting?: SortingState;
  onSortingChange?: (updater: Updater<SortingState>) => void;
  onRemoveSort?: (columnId: string) => void;
  onResetSorts?: () => void;
  onResetAll?: () => void;
}

export function DataTableToolbar<TData extends RowData>({
  instance,
  table: customTable,
  search = instance?.search ?? "",
  onSearchChange = instance?.setSearch ?? (() => {}),
  searchPlaceholder = "Search records...",
  actions,
  onRefresh = instance?.refresh ?? (() => {}),
  loading = instance?.loading ?? false,
  dateRange = instance?.dateRange,
  onDateRangeChange = instance?.setDateRange ?? (() => {}),
  filterConfigs = [],
  filters = instance?.tableState.filters ?? {},
  onFilterChange = instance?.setFilter ?? (() => {}),
  hasActiveFilters = instance?.hasActiveFilters,
  onResetFilters = instance?.resetAllFilters,
  hasActiveSorts = instance?.hasActiveSorts ?? false,
  sorting = instance?.sorting ?? [],
  onSortingChange = instance?.setSorting ?? (() => {}),
  onRemoveSort = instance?.removeSort ?? (() => {}),
  onResetSorts = instance?.resetSorting,
  onResetAll = instance?.resetAllCriteria,
}: DataTableToolbarProps<TData>) {
  const table = customTable ?? instance?.table;
  if (!table) return null;

  return (
    <div className="flex flex-col gap-2 shrink-0">
      {/* Controls Container: Mobile Multi-Row / Desktop Split Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-auto">
          <DataTableSearchInput
            placeholder={searchPlaceholder}
            value={search}
            onChange={onSearchChange}
          />
        </div>

        <div className="flex-1 min-w-0 sm:flex-initial sm:w-auto">
          <DatePickerWithRange date={dateRange} onDateChange={onDateRangeChange} />
        </div>

        <div className="flex items-center gap-2 sm:ml-auto shrink-0">
          {actions}
          <DataTableRefreshButton onClick={onRefresh} loading={loading} />
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Row 2: Entity Facets + Unified Clear All + Multi-Sort Priority Chips */}
      {(filterConfigs.length > 0 || hasActiveFilters || hasActiveSorts) && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
            <DataTableClearButton label="Clear all" onClick={onResetFilters} />
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
      )}
    </div>
  );
}
