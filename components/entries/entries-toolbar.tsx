"use client";

import type { ReactTable, RowData, SortingState, Updater } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import {
  DataTableSearchInput,
  DataTableFacetedFilter,
  DataTableRefreshButton,
  type FacetedFilterOption,
  DataTableViewOptions,
  DatePickerWithRange,
  type DataTableFeatures,
  DataTableCriteriaBar,
} from "@/components/data-table";
import { HugeiconsIcon } from "@hugeicons/react";

export interface EntriesFilterConfig {
  key: string;
  title: string;
  options: FacetedFilterOption[];
  variant: "stone" | "emerald" | "orange" | "primary";
  categoryIcon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
}

export interface EntriesToolbarProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onRefresh: () => void;
  loading?: boolean;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  filterConfigs: EntriesFilterConfig[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  hasActiveSorts: boolean;
  sorting: SortingState;
  onSortingChange: (updater: Updater<SortingState>) => void;
  onRemoveSort: (columnId: string) => void;
  columnLabels: Record<string, string>;
  columnIcons: Record<string, unknown>;
  onResetSorts: () => void;
  onResetAll: () => void;
}

export function EntriesToolbar<TData extends RowData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder = "Search entries...",
  onRefresh,
  loading,
  dateRange,
  onDateRangeChange,
  filterConfigs,
  filters,
  onFilterChange,
  hasActiveSorts,
  sorting,
  onSortingChange,
  onRemoveSort,
  columnLabels,
  columnIcons,
  onResetSorts,
  onResetAll,
}: EntriesToolbarProps<TData>) {
  return (
    <div className="flex flex-col gap-2 shrink-0">
      {/* Row 1: Search Box (Left) + Refresh Button, Date Range Picker & Columns (Right) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <DataTableSearchInput
            placeholder={searchPlaceholder}
            value={search}
            onChange={onSearchChange}
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <DataTableRefreshButton onClick={onRefresh} loading={loading} />
          <DatePickerWithRange
            date={dateRange}
            onDateChange={onDateRangeChange}
            className="flex-1 sm:flex-initial"
          />
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Row 2: Filter Comboboxes + Multi-Sort Priority Chips */}
      <div className="flex flex-wrap items-center gap-2">
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

        <DataTableCriteriaBar
          hasActiveSorts={hasActiveSorts}
          sorting={sorting}
          onSortingChange={onSortingChange}
          onRemoveSort={onRemoveSort}
          columnLabels={columnLabels}
          columnIcons={columnIcons}
          onResetSorts={onResetSorts}
          onResetAll={onResetAll}
        />
      </div>
    </div>
  );
}
