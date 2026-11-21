"use client";

import * as React from "react";
import type { RowData } from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { DataTableSearchInput } from "./search-input";
import { DataTableRefreshButton } from "./refresh-button";
import { DataTableViewOptions } from "./view-options";
import { DataTableFacetedFilter, type FacetedFilterOption } from "./faceted-filter";
import { DataTableClearButton } from "./clear-button";
import { DataTableCriteriaBar } from "./criteria-bar";
import { DatePickerWithRange } from "./date-range-picker";
import type { UseDataTableReturn } from "@/hooks/use-data-table";

export interface DataTableFilterConfig {
  key: string;
  title: string;
  options: FacetedFilterOption[];
  variant: "stone" | "emerald" | "orange" | "primary";
  categoryIcon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
}

export interface DataTableToolbarProps<TData extends RowData> {
  instance: UseDataTableReturn<TData>;
  searchPlaceholder: string;
  actions?: React.ReactNode;
  loading?: boolean;
  filterConfigs?: DataTableFilterConfig[];
}

export function DataTableToolbar<TData extends RowData>({
  instance,
  searchPlaceholder,
  actions,
  loading: customLoading,
  filterConfigs = [],
}: DataTableToolbarProps<TData>) {
  const {
    table,
    search,
    setSearch,
    dateRange,
    setDateRange,
    loading: instanceLoading,
    refresh,
    tableState,
    setFilter,
    hasActiveFilters,
    resetAllFilters,
    hasActiveSorts,
    sorting,
    setSorting,
    removeSort,
    resetSorting,
  } = instance;

  const loading = customLoading ?? instanceLoading;
  const filters = tableState.filters;

  return (
    <div className="flex flex-col gap-2 shrink-0">
      {/* Controls Container: Mobile Multi-Row / Desktop Split Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-auto">
          <DataTableSearchInput
            placeholder={searchPlaceholder}
            value={search}
            onChange={setSearch}
          />
        </div>

        <div className="flex-1 min-w-0 sm:flex-initial sm:w-auto">
          <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
        </div>

        <div className="flex items-center gap-2 sm:ml-auto shrink-0">
          {actions}
          <DataTableRefreshButton onClick={refresh} loading={loading} />
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
              onValueChange={(val: string) => setFilter(config.key, val)}
            />
          ))}

          {hasActiveFilters && <DataTableClearButton label="Clear all" onClick={resetAllFilters} />}

          <DataTableCriteriaBar
            hasActiveSorts={hasActiveSorts}
            sorting={sorting}
            onSortingChange={setSorting}
            onRemoveSort={removeSort}
            onResetSorts={resetSorting}
          />
        </div>
      )}
    </div>
  );
}
