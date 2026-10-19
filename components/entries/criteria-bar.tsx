"use client";

import type { SortingState, Updater } from "@tanstack/react-table";
import { DataTableCriteriaBar } from "@/components/data-table";

export interface EntriesCriteriaBarProps {
  hasActiveSorts: boolean;
  sorting: SortingState;
  onSortingChange: (updater: Updater<SortingState>) => void;
  onRemoveSort: (columnId: string) => void;
  onResetSorts?: () => void;
  onResetAll?: () => void;
}

export function EntriesCriteriaBar({
  hasActiveSorts,
  sorting,
  onSortingChange,
  onRemoveSort,
  onResetSorts,
  onResetAll,
}: EntriesCriteriaBarProps) {
  return (
    <DataTableCriteriaBar
      hasActiveSorts={hasActiveSorts}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onRemoveSort={onRemoveSort}
      onResetSorts={onResetSorts}
      onResetAll={onResetAll}
    />
  );
}
