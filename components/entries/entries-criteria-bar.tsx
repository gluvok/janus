"use client";

import type { SortingState, Updater } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import { DataTableCriteriaBar, DataTableDateRangeChip } from "@/components/data-table";

export interface EntriesCriteriaBarProps {
  hasActiveFilters: boolean;
  hasActiveSorts: boolean;
  sorting: SortingState;
  onSortingChange: (updater: Updater<SortingState>) => void;
  onRemoveSort: (columnId: string) => void;
  columnLabels: Record<string, string>;
  columnIcons: Record<string, unknown>;
  onResetFilters: () => void;
  onResetSorts: () => void;
  onResetAll: () => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

export function EntriesCriteriaBar({
  hasActiveFilters,
  hasActiveSorts,
  sorting,
  onSortingChange,
  onRemoveSort,
  columnLabels,
  columnIcons,
  onResetFilters,
  onResetSorts,
  onResetAll,
  dateRange,
  onDateRangeChange,
}: EntriesCriteriaBarProps) {
  return (
    <DataTableCriteriaBar
      hasActiveFilters={hasActiveFilters}
      hasActiveSorts={hasActiveSorts}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onRemoveSort={onRemoveSort}
      columnLabels={columnLabels}
      columnIcons={columnIcons}
      onResetFilters={onResetFilters}
      onResetSorts={onResetSorts}
      onResetAll={onResetAll}
    >
      {/* Active Date Range Chip (Golden Honey Amber) */}
      <DataTableDateRangeChip dateRange={dateRange} onRemove={() => onDateRangeChange(undefined)} />
    </DataTableCriteriaBar>
  );
}
