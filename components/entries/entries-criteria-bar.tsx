"use client";

import type { SortingState, Updater } from "@tanstack/react-table";
import { DataTableCriteriaBar } from "@/components/data-table";

export interface EntriesCriteriaBarProps {
  hasActiveSorts: boolean;
  sorting: SortingState;
  onSortingChange: (updater: Updater<SortingState>) => void;
  onRemoveSort: (columnId: string) => void;
  columnLabels: Record<string, string>;
  columnIcons: Record<string, unknown>;
  onResetSorts: () => void;
  onResetAll: () => void;
}

export function EntriesCriteriaBar({
  hasActiveSorts,
  sorting,
  onSortingChange,
  onRemoveSort,
  columnLabels,
  columnIcons,
  onResetSorts,
  onResetAll,
}: EntriesCriteriaBarProps) {
  return (
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
  );
}
