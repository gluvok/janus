"use client";

import type { SortingState, Updater } from "@tanstack/react-table";
import { DataTableCriteriaBar, type ColumnMetaConfig } from "@/components/data-table";

export interface EntriesCriteriaBarProps {
  hasActiveSorts: boolean;
  sorting: SortingState;
  onSortingChange: (updater: Updater<SortingState>) => void;
  onRemoveSort: (columnId: string) => void;
  columnsConfig?: Record<string, ColumnMetaConfig>;
  onResetSorts?: () => void;
  onResetAll?: () => void;
}

export function EntriesCriteriaBar({
  hasActiveSorts,
  sorting,
  onSortingChange,
  onRemoveSort,
  columnsConfig,
  onResetSorts,
  onResetAll,
}: EntriesCriteriaBarProps) {
  return (
    <DataTableCriteriaBar
      hasActiveSorts={hasActiveSorts}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onRemoveSort={onRemoveSort}
      columnsConfig={columnsConfig}
      onResetSorts={onResetSorts}
      onResetAll={onResetAll}
    />
  );
}
