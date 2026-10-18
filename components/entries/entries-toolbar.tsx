"use client";

import type { ReactTable, RowData } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import {
  DataTableSearchInput,
  DataTableFacetedFilter,
  DataTableRefreshButton,
  type FacetedFilterOption,
  DataTableViewOptions,
  DatePickerWithRange,
  type DataTableFeatures,
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
  onRefresh: () => void;
  loading?: boolean;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  filterConfigs: EntriesFilterConfig[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
}

export function EntriesToolbar<TData extends RowData>({
  table,
  search,
  onSearchChange,
  onRefresh,
  loading,
  dateRange,
  onDateRangeChange,
  filterConfigs,
  filters,
  onFilterChange,
}: EntriesToolbarProps<TData>) {
  return (
    <div className="flex flex-col gap-2 shrink-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Search Box & Filters side-by-side */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <DataTableSearchInput
            placeholder="Search entries..."
            value={search}
            onChange={onSearchChange}
          />
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
        </div>

        {/* Right: Refresh Button, Date Range Picker & Columns */}
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
    </div>
  );
}
